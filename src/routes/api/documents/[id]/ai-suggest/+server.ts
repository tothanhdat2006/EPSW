import { json, error } from '@sveltejs/kit';
import OpenAI from 'openai';
import type { RequestHandler } from './$types';
import { DEPARTMENT_LABELS, VALID_DEPARTMENTS } from '$lib/api/types';
import { env } from '$env/dynamic/private';
import {
	appendDocumentFilesAsVisionContent,
	parseRawFileUrls,
	type VisionContentPart
} from '$lib/server/ai-document';

function getDB(platform: App.Platform | undefined) {
	return (platform?.env as Record<string, unknown> | undefined)?.['DB'] as D1Database | undefined;
}

/**
 * POST /api/documents/[id]/ai-suggest
 * Uses Alibaba DashScope to suggest the best-fit department for a document.
 * Returns: { department: 'SO_TAI_NGUYEN_MOI_TRUONG', is_valid: true, reason: '...' }
 */
export const POST: RequestHandler = async ({ params, platform, locals }) => {
	const db = getDB(platform);
	if (!db)          return error(503, 'Database unavailable');
	if (!locals.user) return error(401, 'Unauthorized');

	const { id } = params;

	const doc = await db.prepare(
		`SELECT tracking_code, document_type, extracted_data, raw_file_url FROM document WHERE tracking_code = ? OR id = ? LIMIT 1`
	).bind(id, id).first<Record<string, unknown>>();

	if (!doc) return error(404, 'Không tìm thấy hồ sơ.');

	let extracted: Record<string, unknown> = {};
	if (doc['extracted_data']) {
		try {
			extracted = JSON.parse(doc['extracted_data'] as string);
		} catch {}
	}
	const docType = doc['document_type'] ?? 'CA_NHAN';
	const rawFileUrls = parseRawFileUrls(doc['raw_file_url'] as string | undefined);

	// Build department list for the prompt
	const deptList = VALID_DEPARTMENTS.map(d => `- ${d}: ${DEPARTMENT_LABELS[d]}`).join('\n');

	const apiKey  = env.LLM_API_KEY  ?? '';
	const baseUrl = env.LLM_BASE_URL ?? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
	const model   = env.LLM_MODEL    ?? 'qwen-plus';

	if (!apiKey) {
		// Fallback: return first department with a note
		return json({ is_valid: true, department: 'SO_TAI_NGUYEN_MOI_TRUONG', reason: 'AI chưa được cấu hình — cho phép mặc định.' });
	}

	const openai = new OpenAI({
		apiKey,
		baseURL: baseUrl,
		timeout: 10000, // fail fast to fallback gracefully
		maxRetries: 5
	});

	try {
		const contentParts: VisionContentPart[] = [
			{
				type: 'text',
				text:
					`Loại hồ sơ: ${docType}\n` +
					`Thông tin trích xuất sẵn (nếu có): ${JSON.stringify(extracted, null, 2)}\n\n` +
					'Hãy đọc toàn bộ các tệp đính kèm và đánh giá tính hợp lệ cơ bản của hồ sơ.'
			}
		];

		await appendDocumentFilesAsVisionContent(contentParts, rawFileUrls, platform, {
			logPrefix: 'ai-suggest',
			maxPdfPages: 8
		});

		const res = await openai.chat.completions.create({
			model,
			messages: [
				{
					role: 'system',
					content: `Bạn là chuyên viên hành chính tại bộ phận Một Cửa của cổng DVC Việt Nam.\nHãy kiểm tra xem hồ sơ dưới đây có hợp lệ và đầy đủ thông tin hay không. Nếu hợp lệ, hãy xác định đơn vị thụ lý chuyên môn phù hợp nhất từ danh sách sau:\n${deptList}\n\nHãy trả lời bằng JSON ĐÚNG theo định dạng sau:\n{"is_valid": true/false, "department": "<ID_ĐƠN_VỊ>", "reason": "<Lý do đánh giá hợp lệ và giải thích việc chọn đơn vị thụ lý bằng tiếng Việt, tối đa 2 câu>"}`
				},
				{
					role: 'user',
					content: contentParts as any
				}
			],
			response_format: { type: 'json_object' },
			max_tokens: 1000,
		});

		const content = res.choices[0]?.message?.content ?? '{}';
		const parsed = JSON.parse(content) as { is_valid?: boolean; department?: string; reason?: string };

		const dept = VALID_DEPARTMENTS.includes(parsed.department as never)
			? parsed.department
			: VALID_DEPARTMENTS[0];

		return json({
			is_valid: parsed.is_valid ?? true,
			department: dept,
			reason: parsed.reason ?? ''
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'Unknown error';
		console.warn(`[ai-suggest] LLM connection failed: ${msg}. Sử dụng gợi ý mặc định.`);
		return json({ is_valid: true, department: 'SO_TAI_NGUYEN_MOI_TRUONG', reason: 'Không thể kết nối AI — gợi ý mặc định.' });
	}
};
