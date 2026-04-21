import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import OpenAI from 'openai';
import { getAiOutputInstruction, getRequestLocale } from '$lib/i18n';

function getDB(platform: App.Platform | undefined) {
	return (platform?.env as Record<string, unknown> | undefined)?.['DB'] as D1Database | undefined;
}

export const POST: RequestHandler = async ({ params, request, platform, locals, cookies }) => {
	const db = getDB(platform);
	if (!db) return error(503, 'Database unavailable');
	if (!locals.user) return error(401, 'Unauthorized');

	const { role } = locals.user as { role: string };
	if (role !== 'lanh_dao' && role !== 'admin') {
		return error(403, 'Chỉ Lãnh đạo mới có thể dùng AI gợi ý chỉ đạo.');
	}

	const { id } = params;
	const locale = getRequestLocale(request.headers) || getRequestLocale(cookies);
	const body = (await request.json()) as { decision: string };
	const decision = body.decision;

	const doc = await db
		.prepare(`SELECT extracted_data FROM document WHERE id = ? LIMIT 1`)
		.bind(id)
		.first<Record<string, unknown>>();

	if (!doc) return error(404, 'Không tìm thấy hồ sơ.');
	if (!env.LLM_API_KEY) return error(500, 'AI chưa được cấu hình.');

	const openai = new OpenAI({
		apiKey: env.LLM_API_KEY,
		baseURL: env.LLM_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
	});

	// Use normal text model, fast
	const model = env.LLM_MODEL || 'qwen-plus';

	let extractedData: Record<string, any> = {};
	if (doc['extracted_data']) {
		try {
			extractedData = JSON.parse(doc['extracted_data'] as string);
		} catch (_) {}
	}

	const officerBrief = extractedData.ai_officer_brief || '';
	const aiSummary = extractedData.ai_summary || '';
	const feedbacks: any[] = extractedData.officerFeedback || [];
	const lastFeedback = feedbacks.length > 0 ? feedbacks[feedbacks.length - 1].feedback : '';

	let instruction = '';
	if (decision === 'APPROVED') {
		instruction =
			'Soạn 1 câu ngắn gọn đồng ý phê duyệt thay cho Lãnh đạo dựa trên đề xuất của chuyên viên.';
	} else if (decision === 'REJECTED') {
		instruction = 'Soạn 2-3 câu từ chối hồ sơ, nêu lý do hợp lý dựa trên thông tin hồ sơ chưa đạt.';
	} else {
		instruction =
			'Soạn 2-3 câu yêu cầu chuyên viên/công dân sửa đổi, bổ sung thêm tài liệu còn thiếu hoặc chưa chính xác.';
	}

	const prompt = `Bạn là Lãnh đạo cơ quan nhà nước. Dựa trên các thông tin sau về một hồ sơ:
- Tóm tắt AI: ${aiSummary}
- Báo cáo của chuyên viên trình: ${officerBrief}
- Ý kiến chuyên môn của chuyên viên: ${lastFeedback}

Nhiệm vụ: ${instruction}
Viết rất ngắn gọn, súc tích, văn phong chỉ đạo dứt khoát. Bắt đầu thẳng vào ý chính, không cần chào hỏi hay kính gửi. KHÔNG dùng markdown.
${getAiOutputInstruction(locale)}`;

	try {
		const completion = await openai.chat.completions.create(
			{ model, messages: [{ role: 'user', content: prompt }] },
			{ timeout: 30000, maxRetries: 1 }
		);
		const brief = completion.choices[0]?.message?.content?.trim() || '';
		return json({ success: true, report: brief });
	} catch (e: any) {
		console.error('[ai-leader-brief] Failed:', e.message);
		return error(502, `Lỗi AI: ${e.message}`);
	}
};
