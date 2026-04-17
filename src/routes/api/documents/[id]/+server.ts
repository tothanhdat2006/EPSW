import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function getDB(platform: App.Platform | undefined) {
	return (platform?.env as Record<string, unknown> | undefined)?.['DB'] as D1Database | undefined;
}

// GET /api/documents/[id] — public tracking endpoint (requires CCCD verification)
export const GET: RequestHandler = async ({ params, url, platform, locals }) => {
	const db = getDB(platform);
	const { id } = params;
	const cccd = url.searchParams.get('cccd');

	if (!id) return error(400, 'Missing tracking code or document ID');
	if (!db)  return error(503, 'Database unavailable');

	const isOfficer = !!locals.user;

	const row = await db.prepare(
		`SELECT id, tracking_code, status, document_type, citizen_email, citizen_cccd,
		        ai_confidence, security_level, sla_deadline, raw_file_url,
				assigned_dept, assigned_by, assignment_note, extracted_data,
		        created_at, updated_at
		 FROM document WHERE tracking_code = ? OR id = ? LIMIT 1`
	).bind(id, id).first<Record<string, unknown>>();

	if (!row) return error(404, 'Không tìm thấy hồ sơ với mã này.');

	// Public access requires CCCD and hides sensitive internal notes
	if (!isOfficer) {
		if (!cccd) {
			return error(403, 'Vui lòng cung cấp Số CCCD để tra cứu hồ sơ.');
		}
		if (String(row['citizen_cccd'] ?? '').trim() !== cccd.trim()) {
			return error(403, 'Số CCCD không khớp. Vui lòng kiểm tra lại.');
		}

		return json({
			id:            row['id'],
			trackingCode:  row['tracking_code'],
			status:        row['status'],
			documentType:  row['document_type'] ?? 'CA_NHAN',
			securityLevel: row['security_level'] ?? 'UNCLASSIFIED',
			aiConfidence:  row['ai_confidence'] ?? null,
			slaDeadline:   row['sla_deadline'] ? new Date((row['sla_deadline'] as number) * 1000).toISOString() : null,
			createdAt:     new Date((row['created_at'] as number) * 1000).toISOString(),
			updatedAt:     new Date((row['updated_at'] as number) * 1000).toISOString(),
		});
	}

	let rawFileUrls: string[] = [];
	const rawFileUrlStr = row['raw_file_url'] as string | undefined;
	if (rawFileUrlStr) {
		try {
			rawFileUrls = rawFileUrlStr.startsWith('[') ? JSON.parse(rawFileUrlStr) : [rawFileUrlStr];
		} catch (_) {
			rawFileUrls = [rawFileUrlStr];
		}
	}

	// Internal officer access yields full payload including AI summaries
	return json({
		id:            row['id'],
		trackingCode:  row['tracking_code'],
		status:        row['status'],
		documentType:  row['document_type'] ?? 'CA_NHAN',
		securityLevel: row['security_level'] ?? 'UNCLASSIFIED',
		aiConfidence:  row['ai_confidence'] ?? null,
		slaDeadline:   row['sla_deadline'] ? new Date((row['sla_deadline'] as number) * 1000).toISOString() : null,
		assignedDept:  row['assigned_dept'] ?? null,
		assignedBy:    row['assigned_by'] ?? null,
		assignmentNote: row['assignment_note'] ?? null,
		citizenEmail:  row['citizen_email'] ?? null,
		rawFileUrls,
		createdAt:     new Date((row['created_at'] as number) * 1000).toISOString(),
		updatedAt:     new Date((row['updated_at'] as number) * 1000).toISOString(),
		extractedData: row['extracted_data'] ? JSON.parse(row['extracted_data'] as string) : undefined,
	});
};
