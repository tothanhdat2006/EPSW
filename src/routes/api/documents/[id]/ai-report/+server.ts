import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import OpenAI from 'openai';
import {
	appendDocumentFilesAsVisionContent,
	parseRawFileUrls,
	type VisionContentPart
} from '$lib/server/ai-document';
import { getAiOutputInstruction, getRequestLocale } from '$lib/i18n';

function getDB(platform: App.Platform | undefined) {
	return (platform?.env as Record<string, unknown> | undefined)?.['DB'] as D1Database | undefined;
}

/**
 * POST /api/documents/[id]/ai-report
 * AI generates a professional "Biên bản xử lý chuyên môn" for the document,
 * reading the document file + all existing comments/officer feedback.
 * Returns { report: string, recommendation: 'APPROVE' | 'REVISION_REQUESTED' }
 */
export const POST: RequestHandler = async ({ params, platform, locals, request, cookies }) => {
	const db = getDB(platform);
	if (!db) return error(503, 'Database unavailable');
	if (!locals.user) return error(401, 'Unauthorized');

	const { role } = locals.user as { role: string };
	if (role !== 'chuyen_vien' && role !== 'admin') {
		return error(403, 'Chỉ Chuyên viên mới có thể tạo biên bản.');
	}

	const { id } = params;
	const locale = getRequestLocale(request.headers) || getRequestLocale(cookies);

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

	// ----- Parse existing data -----
	let extractedData: Record<string, any> = {};
	if (doc['extracted_data']) {
		try {
			extractedData = JSON.parse(doc['extracted_data'] as string);
		} catch (_) {}
	}

	const aiSummary: string = extractedData.ai_summary || '';
	const comments: any[] = extractedData.comments || [];
	const officerFeedback: any[] = extractedData.officerFeedback || [];

	// ----- Build context strings -----
	const commentBlock =
		comments.length > 0
			? comments
					.map(
						(c: any) =>
							`- [${c.role === 'lanh_dao' ? 'Lãnh đạo' : 'Chuyên viên'} ${c.author} — ${new Date(c.timestamp * 1000).toLocaleDateString('vi-VN')}]: ${c.text}`
					)
					.join('\n')
			: '(Chưa có ý kiến thảo luận)';

	const feedbackBlock =
		officerFeedback.length > 0
			? officerFeedback
					.map((f: any) => `- [${f.officer} — ${f.decision}]: ${f.feedback || 'không ghi rõ'}`)
					.join('\n')
			: '(Chưa có ý kiến luân chuyển trước đó)';

	// ----- Build multimodal content -----
	const contentParts: VisionContentPart[] = [];

	const systemPrompt = `Bạn là Chuyên viên tổng hợp hồ sơ hành chính.

Mục tiêu: soạn "Biên bản xử lý chuyên môn" rõ ràng, thực tế, dễ trình Lãnh đạo.

Nguyên tắc bắt buộc:
- Chỉ dùng thông tin có trong hồ sơ và ngữ cảnh được cung cấp.
- Không bịa đặt, không suy diễn vượt dữ liệu.
- Được phép trình bày linh hoạt (đoạn văn hoặc gạch đầu dòng), không bắt buộc đúng mẫu cứng I/II/III/IV.
- Nếu thiếu thông tin, nêu rõ phần "chưa đủ cơ sở" thay vì tự điền.
- Văn phong hành chính, ngắn gọn, tập trung vào quyết định xử lý.
- Dòng CUỐI CÙNG phải là một trong hai:
  "KẾT LUẬN: APPROVE" hoặc "KẾT LUẬN: REVISION_REQUESTED"
- Không thêm nội dung nào sau dòng KẾT LUẬN.
- ${getAiOutputInstruction(locale)}`;

	const reviewContextPrompt = `Bối cảnh hồ sơ:
1) Tóm tắt AI đã có: ${aiSummary || '(chưa có)'}
2) Ý kiến thảo luận của cán bộ:
${commentBlock}
3) Ý kiến luân chuyển trước đó:
${feedbackBlock}

Yêu cầu đầu ra:
- Soạn một biên bản xử lý chuyên môn linh hoạt theo tình huống thực tế.
- Nên bao gồm: tóm tắt hồ sơ, nhận xét tính hợp lệ, tổng hợp ý kiến, và đề xuất xử lý.
- Có thể thêm hoặc lược bớt mục nếu cần, miễn rõ ràng và hợp lý.`;

	contentParts.push({ type: 'text', text: reviewContextPrompt });

	// Attach document pages as images
	const rawFileUrls = parseRawFileUrls(doc['raw_file_url'] as string | undefined);
	await appendDocumentFilesAsVisionContent(contentParts, rawFileUrls, platform, {
		logPrefix: 'ai-report',
		maxPdfPages: 8
	});

	// ----- Call AI -----
	let rawOutput = '';
	try {
		console.log(`[ai-report] Calling model "${model}" with ${contentParts.length} parts`);
		const completion = await openai.chat.completions.create(
			{
				model,
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: contentParts as any }
				]
			},
			{ timeout: 120000, maxRetries: 1 }
		);
		rawOutput = completion.choices[0]?.message?.content?.trim() || '';
	} catch (e: any) {
		console.error('[ai-report] Failed:', e.message);
		return error(502, `AI Timeout hoặc lỗi kết nối: ${e.message}`);
	}

	// ----- Parse recommendation from last line -----
	const lines = rawOutput.split('\n');
	let recommendation: 'APPROVE' | 'REVISION_REQUESTED' = 'APPROVE';
	let reportText = rawOutput;

	let conclusionLineIdx = -1;
	let conclusionValue = '';
	for (let i = lines.length - 1; i >= 0; i--) {
		const match = lines[i].trim().match(/^K[ẾE]T LU[ẬA]N\s*:\s*(.+)$/i);
		if (match) {
			conclusionLineIdx = i;
			conclusionValue = match[1].trim().toUpperCase();
			break;
		}
	}

	if (conclusionLineIdx !== -1) {
		if (
			conclusionValue.includes('REVISION_REQUESTED') ||
			conclusionValue.includes('REVISION') ||
			conclusionValue.includes('SUA_DOI') ||
			conclusionValue.includes('YEU_CAU')
		) {
			recommendation = 'REVISION_REQUESTED';
		}
		// Strip the KẾT LUẬN line from the visible report
		reportText = lines.slice(0, conclusionLineIdx).join('\n').trim();
	} else if (rawOutput.toUpperCase().includes('REVISION_REQUESTED')) {
		// Fallback if model missed the exact "KẾT LUẬN:" prefix
		recommendation = 'REVISION_REQUESTED';
	}

	return json({ success: true, report: reportText, recommendation });
};
