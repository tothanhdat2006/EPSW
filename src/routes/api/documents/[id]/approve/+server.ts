import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { emailService } from '$lib/server/email-service';

function getDB(platform: App.Platform | undefined) {
	return (platform?.env as Record<string, unknown> | undefined)?.['DB'] as D1Database | undefined;
}

export const POST: RequestHandler = async ({ params, request, platform, locals }) => {
	const db = getDB(platform);
	if (!db) return error(503, 'Database unavailable');
	if (!locals.user) return error(401, 'Unauthorized');

	const { role, name } = locals.user as { role: string; name: string };
	if (role !== 'lanh_dao' && role !== 'admin') {
		return error(403, 'Chỉ Lãnh đạo mới có quyền phê duyệt hồ sơ.');
	}

	const { id } = params;
	const body = await request.json() as { decision?: string; feedback?: string };
	const rawDecision = body.decision ?? 'APPROVED';
	// Lãnh đạo can decide APPROVED, REJECTED, or REVISION_REQUESTED
	const decision = (rawDecision === 'REJECTED' || rawDecision === 'REVISION_REQUESTED') ? rawDecision : 'APPROVED';
	const feedback = body.feedback ?? '';

	if ((decision === 'REJECTED' || decision === 'REVISION_REQUESTED') && !feedback.trim()) {
		return error(400, 'Vui lòng nêu rõ lý do hoặc nội dung cần sửa đổi.');
	}

	const doc = await db.prepare(
		`SELECT status, extracted_data, tracking_code, citizen_email FROM document WHERE id = ? LIMIT 1`
	).bind(id).first<Record<string, unknown>>();

	if (!doc) return error(404, 'Không tìm thấy hồ sơ.');

	if (doc.status !== 'PENDING_APPROVAL') {
		return error(400, 'Hồ sơ chưa được Chuyên viên trình duyệt.');
	}

	const now = Math.floor(Date.now() / 1000);

	let extractedData: Record<string, any> = {};
	if (doc.extracted_data) {
		try { extractedData = JSON.parse(doc.extracted_data as string); } catch(e){}
	}

	extractedData.leadershipFeedback = extractedData.leadershipFeedback || [];
	extractedData.leadershipFeedback.push({
		officer: name,
		role,
		decision,
		feedback,
		timestamp: now
	});

	await db.prepare(
		`UPDATE document SET status = ?, extracted_data = ?, updated_at = ? WHERE id = ?`
	).bind(decision, JSON.stringify(extractedData), now, id).run();

	// Log audit
	await db.prepare(
		`INSERT INTO audit_log (id, document_id, action, actor_id, actor_role, correlation_id, metadata, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	).bind(
		crypto.randomUUID(), id, decision === 'APPROVED' ? 'APPROVED' : (decision === 'REJECTED' ? 'REJECTED' : 'RETURNED_FOR_REVISION'), locals.user.id, role,
		crypto.randomUUID(),
		JSON.stringify({ decision, feedback }),
		now
	).run();

	// Email notifications
	const citizenEmail = doc['citizen_email'] as string | null;
	const trackingCode = doc['tracking_code'] as string;
	if (citizenEmail && (decision === 'APPROVED' || decision === 'REJECTED')) {
		try {
			if (decision === 'APPROVED') {
				await emailService.notifyDocumentApproved(citizenEmail, 'Quý công dân', trackingCode);
			} else {
				await emailService.notifyDocumentRejected(citizenEmail, 'Quý công dân', trackingCode, feedback || 'Hồ sơ không đạt yêu cầu.');
			}
		} catch (e) {
			console.error('[approve] Failed to send email:', e);
		}
	}

	return json({ success: true, status: decision });
};
