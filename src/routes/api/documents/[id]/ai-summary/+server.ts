import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import OpenAI from 'openai';
import {
	appendDocumentFilesAsVisionContent,
	parseRawFileUrls,
	type VisionContentPart
} from '$lib/server/ai-document';

function getDB(platform: App.Platform | undefined) {
	return (platform?.env as Record<string, unknown> | undefined)?.['DB'] as D1Database | undefined;
}

/**
 * POST /api/documents/[id]/ai-summary
 * Converts the uploaded file (PDF or image) to PNG images via mupdf WASM,
 * then sends all pages to the configured vision model for summarisation.
 */
export const POST: RequestHandler = async ({ params, platform, locals }) => {
	const db = getDB(platform);
	if (!db) return error(503, 'Database unavailable');
	if (!locals.user) return error(401, 'Unauthorized');

	const { id } = params;

	const doc = await db
		.prepare(`SELECT id, extracted_data, raw_file_url FROM document WHERE id = ? LIMIT 1`)
		.bind(id)
		.first<Record<string, unknown>>();

	if (!doc) return error(404, 'Không tìm thấy hồ sơ.');
	if (!env.LLM_API_KEY) return error(500, 'AI chưa được cấu hình.');

	const openai = new OpenAI({
		apiKey: env.LLM_API_KEY,
		baseURL: env.LLM_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
	});

	const model = env.LLM_MODEL || 'qwen-vl-plus';
	const rawFileUrls = parseRawFileUrls(doc['raw_file_url'] as string | undefined);

	// Build the multimodal content array (text prompt + one image per page)
	const contentParts: VisionContentPart[] = [];

	const summaryPrompt = `Bạn là Chuyên viên phân tích hồ sơ hành chính.
Hãy đọc toàn bộ nội dung các trang tài liệu được đính kèm và viết một "Tờ trình Liên ngành" tóm tắt hồ sơ này trong đúng 3-4 dòng ngắn gọn, súc tích để trình Lãnh đạo xem xét.
Nội dung nên bao gồm: Loại hồ sơ, thông tin chính yếu của người dân/tổ chức nộp hồ sơ.
QUAN TRỌNG: TUYỆT ĐỐI CHỈ SỬ DỤNG thông tin có trong tài liệu đính kèm. KHÔNG ĐƯỢC tự bịa đặt, suy diễn, hoặc thêm bất kỳ thông tin nào bên ngoài. Không giải thích, không output thêm gì ngoài nội dung Tờ trình.`;

	contentParts.push({ type: 'text', text: summaryPrompt });

	await appendDocumentFilesAsVisionContent(contentParts, rawFileUrls, platform, {
		logPrefix: 'ai-summary',
		maxPdfPages: 10
	});

	// If no images were added (e.g. file retrieval failed), add existing extracted data as context
	if (contentParts.length === 1 && doc['extracted_data']) {
		let parsedExtractedData: unknown = doc['extracted_data'];
		try {
			parsedExtractedData = JSON.parse(doc['extracted_data'] as string);
		} catch {}

		contentParts.push({
			type: 'text',
			text: `Dữ liệu đã trích xuất trước đó:\n${JSON.stringify(parsedExtractedData, null, 2)}`
		});
	}

	// --- Send to model ---
	let summary = '';
	try {
		console.log(
			`[ai-summary] Sending to model "${model}" with ${contentParts.length} content part(s)`
		);
		const completion = await openai.chat.completions.create(
			{
				model,
				messages: [{ role: 'user', content: contentParts as any }]
			},
			{ timeout: 120000, maxRetries: 1 }
		);
		summary = completion.choices[0]?.message?.content?.trim() || '';
	} catch (e: any) {
		console.error('[ai-summary] Summary generation failed:', e.message);
		return error(502, `AI Timeout hoặc lỗi kết nối: ${e.message}`);
	}

	// --- Update DB ---
	let currentData: Record<string, unknown> = {};
	if (doc['extracted_data']) {
		try {
			currentData = JSON.parse(doc['extracted_data'] as string);
		} catch (_) {}
	}
	currentData['ai_summary'] = summary;

	try {
		await db
			.prepare('UPDATE document SET extracted_data = ? WHERE id = ?')
			.bind(JSON.stringify(currentData), doc['id'] as string)
			.run();
	} catch (e: any) {
		console.error('[ai-summary] DB update failed:', e);
		return error(500, 'Không thể cập nhật CSDL');
	}

	return json({ success: true, ai_summary: summary });
};
