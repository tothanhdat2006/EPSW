import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import OpenAI from 'openai';
import { getFileBuffer } from '$lib/server/storage';
import * as mupdf from 'mupdf';

function getDB(platform: App.Platform | undefined) {
	return (platform?.env as Record<string, unknown> | undefined)?.['DB'] as D1Database | undefined;
}

/**
 * Render each PDF page to PNG base64 via mupdf WASM (no native deps).
 */
async function pdfToBase64PngImages(pdfBuffer: Buffer, maxPages = 8): Promise<string[]> {
	const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf') as mupdf.PDFDocument;
	const limit = Math.min(doc.countPages(), maxPages);
	const images: string[] = [];
	for (let i = 0; i < limit; i++) {
		const page = doc.loadPage(i);
		const pixmap = page.toPixmap(
			mupdf.Matrix.scale(1.5, 1.5),
			mupdf.ColorSpace.DeviceRGB,
			false
		);
		images.push(Buffer.from(pixmap.asPNG()).toString('base64'));
		pixmap.destroy();
	}
	doc.destroy();
	return images;
}

/**
 * POST /api/documents/[id]/ai-report
 * AI generates a professional "Biên bản xử lý chuyên môn" for the document,
 * reading the document file + all existing comments/officer feedback.
 * Returns { report: string, recommendation: 'APPROVE' | 'REVISION_REQUESTED' }
 */
export const POST: RequestHandler = async ({ params, platform, locals }) => {
	const db = getDB(platform);
	if (!db) return error(503, 'Database unavailable');
	if (!locals.user) return error(401, 'Unauthorized');

	const { role } = locals.user as { role: string };
	if (role !== 'chuyen_vien' && role !== 'admin') {
		return error(403, 'Chỉ Chuyên viên mới có thể tạo biên bản.');
	}

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

	// ----- Parse existing data -----
	let extractedData: Record<string, any> = {};
	if (doc['extracted_data']) {
		try { extractedData = JSON.parse(doc['extracted_data'] as string); } catch (_) {}
	}

	const aiSummary: string = extractedData.ai_summary || '';
	const comments: any[] = extractedData.comments || [];
	const officerFeedback: any[] = extractedData.officerFeedback || [];

	// ----- Build context strings -----
	const commentBlock = comments.length > 0
		? comments.map((c: any) =>
			`- [${c.role === 'lanh_dao' ? 'Lãnh đạo' : 'Chuyên viên'} ${c.author} — ${new Date(c.timestamp * 1000).toLocaleDateString('vi-VN')}]: ${c.text}`
		).join('\n')
		: '(Chưa có ý kiến thảo luận)';

	const feedbackBlock = officerFeedback.length > 0
		? officerFeedback.map((f: any) =>
			`- [${f.officer} — ${f.decision}]: ${f.feedback || 'không ghi rõ'}`
		).join('\n')
		: '(Chưa có ý kiến luân chuyển trước đó)';

	// ----- Build multimodal content -----
	type ContentPart =
		| { type: 'text'; text: string }
		| { type: 'image_url'; image_url: { url: string } };

	const contentParts: ContentPart[] = [];

	const systemPrompt = `Bạn là Chuyên viên tổng hợp có nhiệm vụ soạn thảo "Biên bản xử lý chuyên môn" cho một hồ sơ hành chính.

Dựa trên:
1. Nội dung tài liệu đính kèm (hình ảnh các trang hồ sơ)
2. Tóm tắt AI đã có: ${aiSummary || '(chưa có)'}
3. Ý kiến thảo luận của cán bộ:
${commentBlock}
4. Ý kiến luân chuyển trước đó:
${feedbackBlock}

Hãy soạn thảo Biên bản xử lý chuyên môn theo cấu trúc sau (dùng văn phong hành chính trang trọng, ngắn gọn):

**I. Tóm tắt nội dung hồ sơ**
[2-3 câu mô tả loại hồ sơ, chủ thể nộp, nội dung yêu cầu]

**II. Nhận xét về tính hợp lệ**
[Đánh giá tính đầy đủ, hợp lệ của hồ sơ theo quy định]

**III. Ý kiến của cán bộ thụ lý**
[Tổng hợp các ý kiến thảo luận đã có]

**IV. Đề xuất**
[Chỉ một trong hai: "Đề nghị Lãnh đạo PHÊ DUYỆT" hoặc "Đề nghị YÊU CẦU SỬA ĐỔI bổ sung vì [lý do cụ thể]"]

QUAN TRỌNG:
- Dòng cuối cùng phải là một trong hai: "KẾT LUẬN: APPROVE" hoặc "KẾT LUẬN: REVISION_REQUESTED"
- Không thêm bất kỳ chú thích nào sau dòng KẾT LUẬN
- Chỉ dùng thông tin từ hồ sơ thực tế, không bịa đặt`;

	contentParts.push({ type: 'text', text: systemPrompt });

	// Attach document pages as images
	const rawFileUrlStr = doc['raw_file_url'] as string | undefined;
	const rawFileUrls: string[] = rawFileUrlStr ? (rawFileUrlStr.startsWith('[') ? JSON.parse(rawFileUrlStr) : [rawFileUrlStr]) : [];
	
	for (const rawFileUrl of rawFileUrls) {
		const buffer = await getFileBuffer(rawFileUrl, platform);
		if (buffer) {
			const ext = rawFileUrl.split('.').pop()?.toLowerCase() || '';
			if (ext === 'pdf') {
				try {
					const pages = await pdfToBase64PngImages(buffer);
					for (const b64 of pages) {
						contentParts.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } });
					}
				} catch (e: any) {
					console.warn('[ai-report] PDF render failed:', e.message);
				}
			} else {
				const mimeType = ext === 'webp' ? 'image/webp' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
				contentParts.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${buffer.toString('base64')}` } });
			}
		}
	}

	// ----- Call AI -----
	let rawOutput = '';
	try {
		console.log(`[ai-report] Calling model "${model}" with ${contentParts.length} parts`);
		const completion = await openai.chat.completions.create(
			{ model, messages: [{ role: 'user', content: contentParts as any }] },
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

	const conclusionLineIdx = lines.findLastIndex((l) => l.trim().startsWith('KẾT LUẬN:'));
	if (conclusionLineIdx !== -1) {
		const conclusionLine = lines[conclusionLineIdx].trim();
		if (conclusionLine.includes('REVISION_REQUESTED')) {
			recommendation = 'REVISION_REQUESTED';
		}
		// Strip the KẾT LUẬN line from the visible report
		reportText = lines.slice(0, conclusionLineIdx).join('\n').trim();
	}

	return json({ success: true, report: reportText, recommendation });
};
