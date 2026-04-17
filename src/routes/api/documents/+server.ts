import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { VALID_DOCUMENT_TYPES, type DocumentType } from '$lib/api/types';

function getDB(platform: App.Platform | undefined) {
	return (platform?.env as Record<string, unknown> | undefined)?.['DB'] as D1Database | undefined;
}

// POST /api/documents — submit a new document
export const POST: RequestHandler = async ({ request, platform }) => {
	const db = getDB(platform);

	const formData = await request.formData();
	const files = formData.getAll('file');
	const citizenEmail = (formData.get('citizenEmail') as string) || null;
	const citizenCccd = (formData.get('citizenCccd') as string) || null;

	const rawDocType = (formData.get('documentType') as string) || 'CA_NHAN';
	const documentType: DocumentType = VALID_DOCUMENT_TYPES.includes(rawDocType as DocumentType)
		? (rawDocType as DocumentType)
		: 'CA_NHAN';

	if (!files || files.length === 0) return error(400, 'Ít nhất một file là bắt buộc');
	if (!citizenCccd || citizenCccd.trim().length < 9) {
		return error(400, 'Số CCCD không hợp lệ. Vui lòng nhập đúng số CCCD của bạn.');
	}

	const id = crypto.randomUUID();
	const trackingCode = `DVC-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
	const now = Math.floor(Date.now() / 1000);

	const storage = (platform?.env as Record<string, unknown> | undefined)?.['STORAGE'] as R2Bucket | undefined;
	const rawFileUrls: string[] = [];

	for (const item of files) {
		if (!(item instanceof File) || item.size === 0) continue;
		const file = item as File;
		
		const fileId = crypto.randomUUID();
		const originalName = file.name || 'document';
		const ext = originalName.includes('.') ? `.${originalName.split('.').pop()}` : '';
		const filename = `${fileId}${ext}`;
		
		rawFileUrls.push(`/uploads/${filename}`);

		try {
			const buffer = await file.arrayBuffer();
			if (storage) {
				await storage.put(filename, buffer, {
					httpMetadata: { contentType: file.type || 'application/octet-stream' }
				});
			} else {
				// Only works in Node.js dev environments! Safe fallback for cloud runtimes.
				const { writeFileSync, mkdirSync } = await import('node:fs');
				mkdirSync('static/uploads', { recursive: true });
				writeFileSync(`static/uploads/${filename}`, Buffer.from(buffer));
			}
		} catch (e) {
			console.warn('Could not save file to disk or R2:', e);
		}
	}

	if (rawFileUrls.length === 0) return error(400, 'File upload không thành công.');
	const rawFileUrlStr = JSON.stringify(rawFileUrls);

	const slaDeadline = now + 48 * 60 * 60; // 48 hours from submission

	if (db) {
		await db.prepare(
			`INSERT INTO document
			   (id, tracking_code, submitter_id, citizen_email, citizen_cccd,
			    document_type, status, raw_file_url, sla_deadline, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?, ?, ?)`
		).bind(
			id, trackingCode, 'anonymous', citizenEmail, citizenCccd.trim(),
			documentType, rawFileUrlStr, slaDeadline, now, now
		).run();
	}

	return json({ documentId: id, trackingCode, status: 'RECEIVED', message: 'Hồ sơ đã được tiếp nhận.' });
};

// GET /api/documents — list documents (portal, requires auth)
export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const db = getDB(platform);
	const status = url.searchParams.get('status');
	const documentType = url.searchParams.get('documentType');
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
	const limit = Math.min(200, parseInt(url.searchParams.get('limit') ?? '50'));
	const offset = (page - 1) * limit;

	if (!db) return json({ documents: [], total: 0 });
	if (!locals.user) return error(401, 'Unauthorized');

	const { role, department } = locals.user as { role: string; department?: string };

	const conditions: string[] = [];
	const bindings: unknown[] = [];
	
	if (status && status !== 'ALL') { 
		conditions.push('status = ?'); 
		bindings.push(status); 
	} else {
		// Default view hides INVALID and REJECTED for normal staff, but admins see everything
		if (role !== 'admin') {
			conditions.push('status != ?'); bindings.push('INVALID');
			conditions.push('status != ?'); bindings.push('REJECTED');
		}
	}
	
	if (documentType) { 
		conditions.push('document_type = ?'); 
		bindings.push(documentType); 
	}

	// Department scoping for strict staff
	if (role === 'chuyen_vien' || role === 'lanh_dao') {
		if (department) {
			conditions.push('assigned_dept = ?');
			bindings.push(department);
		} else {
			// If they have no department, they see nothing rather than everything
			conditions.push('1 = 0');
		}
	}

	const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

	const countRow = await db
		.prepare(`SELECT COUNT(*) as total FROM document ${where}`)
		.bind(...bindings)
		.first<{ total: number }>();

	const nowSec = Math.floor(Date.now() / 1000);
	const rows = await db.prepare(
		`SELECT id, tracking_code, status, document_type, citizen_email,
		        ai_confidence, security_level, sla_deadline,
		        assigned_dept, assigned_by, assignment_note, raw_file_url,
		        created_at, updated_at, extracted_data
		 FROM document ${where}
		 ORDER BY
		   CASE WHEN sla_deadline IS NOT NULL AND sla_deadline < ${nowSec} AND status NOT IN ('APPROVED','REJECTED','INVALID') THEN 0 ELSE 1 END ASC,
		   created_at DESC
		 LIMIT ? OFFSET ?`
	).bind(...bindings, limit, offset).all();

	const documents = (rows.results ?? []).map((r: Record<string, unknown>) => ({
		id:             r['id'],
		trackingCode:   r['tracking_code'],
		status:         r['status'] ?? 'RECEIVED',
		documentType:   r['document_type'] ?? 'CA_NHAN',
		securityLevel:  r['security_level'] ?? 'UNCLASSIFIED',
		aiConfidence:   r['ai_confidence'] ?? null,
		slaDeadline:    r['sla_deadline'] ? new Date((r['sla_deadline'] as number) * 1000).toISOString() : null,
		assignedDept:   r['assigned_dept'] ?? null,
		assignedBy:     r['assigned_by'] ?? null,
		assignmentNote: r['assignment_note'] ?? null,
		citizenEmail:   r['citizen_email'] ?? null,
		rawFileUrls:    r['raw_file_url'] ? (String(r['raw_file_url']).startsWith('[') ? JSON.parse(r['raw_file_url'] as string) : [r['raw_file_url'] as string]) : [],
		createdAt:      new Date((r['created_at'] as number) * 1000).toISOString(),
		updatedAt:      new Date((r['updated_at'] as number) * 1000).toISOString(),
		extractedData:  r['extracted_data'] ? JSON.parse(r['extracted_data'] as string) : undefined,
	}));

	return json({ documents, total: countRow?.total ?? 0 });
};
