import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import OpenAI from 'openai';
import type { UILocale } from '$lib/i18n';
import { getAiOutputInstruction, getRequestLocale } from '$lib/i18n';

function getDB(platform: App.Platform | undefined) {
	return (platform?.env as Record<string, unknown> | undefined)?.['DB'] as D1Database | undefined;
}

/**
 * Generate a concise AI brief for lãnh đạo summarising what the chuyên viên
 * wrote in the biên bản + all discussion comments.
 * Stored as extractedData.ai_officer_brief.
 * Runs fire-and-forget after the review is saved (no await for the LLM call).
 */
async function generateOfficerBriefInBackground(
	db: D1Database,
	docId: string,
	officerName: string,
	decision: string,
	feedback: string,
	comments: any[],
	existingSummary: string,
	llmApiKey: string,
	llmBaseUrl: string,
	llmModel: string,
	locale: UILocale
): Promise<void> {
	const openai = new OpenAI({
		apiKey: llmApiKey,
		baseURL: llmBaseUrl
	});

	const commentLines =
		comments.length > 0
			? comments
					.map(
						(c: any) =>
							`  • [${c.author} – ${c.role === 'lanh_dao' ? 'Lãnh đạo' : 'Chuyên viên'}]: ${c.text}`
					)
					.join('\n')
			: '  (Không có ý kiến thảo luận)';

	const prompt = `Bạn là trợ lý hành chính. Hãy viết một đoạn TÓM TẮT ngắn gọn (tối đa 5 câu) để trình Lãnh đạo hiểu ngay kết quả xử lý hồ sơ từ Chuyên viên, gồm:
- Tên Chuyên viên phụ trách: ${officerName}
- Đề xuất của Chuyên viên: ${decision === 'APPROVE' ? 'ĐỀ NGHỊ PHÊ DUYỆT' : 'YÊU CẦU SỬA ĐỔI'}
- Nội dung Biên bản xử lý chuyên môn:\n${feedback || '(không ghi rõ)'}
- Tóm tắt hồ sơ AI có sẵn: ${existingSummary || '(chưa có)'}
- Ý kiến thảo luận của các cán bộ:\n${commentLines}

Viết bằng văn phong hành chính, ngắn gọn, súc tích. Bắt đầu bằng "Chuyên viên [tên] đề xuất...". Không dùng markdown.
${getAiOutputInstruction(locale)}`;

	try {
		const completion = await openai.chat.completions.create(
			{ model: llmModel, messages: [{ role: 'user', content: prompt }] },
			{ timeout: 60000, maxRetries: 0 }
		);
		const brief = completion.choices[0]?.message?.content?.trim() || '';
		if (!brief) return;

		// Re-fetch latest extracted_data before patching (avoid overwriting concurrent writes)
		const latest = await db
			.prepare(`SELECT extracted_data FROM document WHERE id = ? LIMIT 1`)
			.bind(docId)
			.first<{ extracted_data: string | null }>();

		let latestData: Record<string, any> = {};
		if (latest?.extracted_data) {
			try {
				latestData = JSON.parse(latest.extracted_data);
			} catch (_) {}
		}
		latestData.ai_officer_brief = brief;

		await db
			.prepare(`UPDATE document SET extracted_data = ? WHERE id = ?`)
			.bind(JSON.stringify(latestData), docId)
			.run();

		console.log(`[review] Officer brief saved for doc ${docId}`);
	} catch (e: any) {
		console.error('[review] Officer brief generation failed:', e.message);
	}
}

export const POST: RequestHandler = async ({ params, request, platform, locals, cookies }) => {
	const db = getDB(platform);
	if (!db) return error(503, 'Database unavailable');
	if (!locals.user) return error(401, 'Unauthorized');

	const { role, name } = locals.user as { role: string; name: string };
	const locale = getRequestLocale(request.headers) || getRequestLocale(cookies);
	if (role !== 'chuyen_vien' && role !== 'admin') {
		return error(403, 'Chỉ Chuyên viên mới có quyền xử lý hồ sơ.');
	}

	const { id } = params;
	const body = (await request.json()) as { decision?: string; feedback?: string };
	const decision = body.decision ?? 'APPROVE';
	const feedback = body.feedback ?? '';

	const doc = await db
		.prepare(`SELECT status, extracted_data FROM document WHERE id = ? LIMIT 1`)
		.bind(id)
		.first<Record<string, unknown>>();

	if (!doc) return error(404, 'Không tìm thấy hồ sơ.');

	if (doc.status !== 'ASSIGNED' && doc.status !== 'REVISION_REQUESTED') {
		return error(400, 'Hồ sơ không ở trạng thái cho phép Chuyên viên xử lý.');
	}

	const now = Math.floor(Date.now() / 1000);

	let extractedData: Record<string, any> = {};
	if (doc.extracted_data) {
		try {
			extractedData = JSON.parse(doc.extracted_data as string);
		} catch (e) {}
	}

	extractedData.officerFeedback = extractedData.officerFeedback || [];
	extractedData.officerFeedback.push({
		officer: name,
		role,
		decision,
		feedback,
		timestamp: now
	});

	await db
		.prepare(
			`UPDATE document SET status = 'PENDING_APPROVAL', extracted_data = ?, updated_at = ? WHERE id = ?`
		)
		.bind(JSON.stringify(extractedData), now, id)
		.run();

	// Log audit
	await db
		.prepare(
			`INSERT INTO audit_log (id, document_id, action, actor_id, actor_role, correlation_id, metadata, created_at)
		 VALUES (?, ?, 'CHANNELED_TO_LEADERSHIP', ?, ?, ?, ?, ?)`
		)
		.bind(
			crypto.randomUUID(),
			id,
			locals.user.id,
			role,
			crypto.randomUUID(),
			JSON.stringify({ decision, feedback }),
			now
		)
		.run();

	// Fire-and-forget: generate AI brief for lãnh đạo in the background
	if (env.LLM_API_KEY) {
		generateOfficerBriefInBackground(
			db,
			id,
			name,
			decision,
			feedback,
			extractedData.comments || [],
			extractedData.ai_summary || '',
			env.LLM_API_KEY,
			env.LLM_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
			env.LLM_MODEL || 'qwen-plus',
			locale
		).catch(() => {
			/* already logged inside */
		});
	}

	return json({ success: true, status: 'PENDING_APPROVAL' });
};
