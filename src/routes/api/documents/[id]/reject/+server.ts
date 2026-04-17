import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { emailService } from '$lib/server/email-service';

function getDB(platform: App.Platform | undefined) {
	return (platform?.env as Record<string, unknown> | undefined)?.['DB'] as D1Database | undefined;
}

/**
 * POST /api/documents/[id]/reject
 * Bộ phận Một cửa rejects an incoming invalid document.
 */
export const POST: RequestHandler = async ({ params, request, platform, locals }) => {
	const db = getDB(platform);
	if (!db)         return error(503, 'Database unavailable');
	if (!locals.user) return error(401, 'Unauthorized');

	const { role } = locals.user as { role: string };
	if (role !== 'mot_cua' && role !== 'admin') {
		return error(403, 'Chỉ Bộ phận Một cửa mới có thể từ chối hồ sơ.');
	}

	const { id } = params;
	const body = await request.json() as { reason?: string };
	const note = body.reason ?? 'Không hợp lệ';

	const doc = await db.prepare(
		`SELECT id, tracking_code, citizen_email, status FROM document WHERE tracking_code = ? OR id = ? LIMIT 1`
	).bind(id, id).first<Record<string, unknown>>();

	if (!doc) return error(404, 'Không tìm thấy hồ sơ.');
	if (doc['status'] !== 'RECEIVED') {
		return error(409, `Hồ sơ đang ở trạng thái "${doc['status']}" — không thể tác động.`);
	}

	const now = Math.floor(Date.now() / 1000);

	await db.prepare(
		`UPDATE document SET status = 'INVALID', assignment_note = ?, updated_at = ? WHERE id = ?`
	).bind(note, now, doc['id']).run();

	await db.prepare(
		`INSERT INTO audit_log (id, document_id, action, actor_id, actor_role, correlation_id, metadata, created_at)
		 VALUES (?, ?, 'INVALIDATED', ?, ?, ?, ?, ?)`
	).bind(
		crypto.randomUUID(), doc['id'], locals.user.id, role,
		crypto.randomUUID(),
		JSON.stringify({ reason: note }),
		now
	).run();

	// Send email to citizen
	const citizenEmail = doc['citizen_email'] as string | null;
	if (citizenEmail) {
		const trackingCode = doc['tracking_code'] as string;
		try {
			await emailService.notifyDocumentRejected(citizenEmail, 'Quý công dân', trackingCode, note);
		} catch (e) {
			console.error('[reject] Failed to send email:', e);
		}
	}

	return json({ success: true, status: 'INVALID' });
};
