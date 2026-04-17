import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function getDB(platform: App.Platform | undefined) {
	return (platform?.env as Record<string, unknown> | undefined)?.['DB'] as D1Database | undefined;
}

export const POST: RequestHandler = async ({ params, request, platform, locals }) => {
	const db = getDB(platform);
	if (!db) return error(503, 'Database unavailable');
	if (!locals.user) return error(401, 'Unauthorized');

	const { role, name } = locals.user as { role: string; name: string };
	
	const { id } = params;
	const body = await request.json() as { text: string; replyTo?: any };
	
	if (!body.text || !body.text.trim()) {
		return error(400, 'Nội dung bình luận không được để trống.');
	}

	const doc = await db.prepare(
		`SELECT status, extracted_data FROM document WHERE id = ? LIMIT 1`
	).bind(id).first<Record<string, unknown>>();

	if (!doc) return error(404, 'Không tìm thấy hồ sơ.');

	const now = Math.floor(Date.now() / 1000);

	let extractedData: Record<string, any> = {};
	if (doc.extracted_data) {
		try { extractedData = JSON.parse(doc.extracted_data as string); } catch(e){}
	}

	extractedData.comments = extractedData.comments || [];
	const newComment = {
		id: crypto.randomUUID(),
		author: name,
		role: role,
		text: body.text.trim(),
		replyTo: body.replyTo || null,
		timestamp: now
	};
	extractedData.comments.push(newComment);

	await db.prepare(
		`UPDATE document SET extracted_data = ?, updated_at = ? WHERE id = ?`
	).bind(JSON.stringify(extractedData), now, id).run();

	return json({ success: true, comment: newComment });
};
