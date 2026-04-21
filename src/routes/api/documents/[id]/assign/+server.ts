import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { VALID_DEPARTMENTS, DEPARTMENT_LABELS, type Department } from '$lib/api/types';
import { emailService } from '$lib/server/email-service';
import { env } from '$env/dynamic/private';
import OpenAI from 'openai';
import { appendDocumentFilesAsVisionContent, parseRawFileUrls } from '$lib/server/ai-document';
import type { UILocale } from '$lib/i18n';
import { getAiOutputInstruction, getRequestLocale } from '$lib/i18n';

function getDB(platform: App.Platform | undefined) {
	return (platform?.env as Record<string, unknown> | undefined)?.['DB'] as D1Database | undefined;
}

/**
 * POST /api/documents/[id]/assign
 * Bộ phận Một cửa assigns a document to a department.
 * Requires role = mot_cua or admin.
 */
export const POST: RequestHandler = async ({ params, request, platform, locals, cookies }) => {
	const db = getDB(platform);
	if (!db) return error(503, 'Database unavailable');
	if (!locals.user) return error(401, 'Unauthorized');

	const { role } = locals.user as { role: string };
	if (role !== 'mot_cua' && role !== 'admin') {
		return error(403, 'Chỉ Bộ phận Một cửa mới có thể phân công hồ sơ.');
	}

	const { id } = params;
	const locale = getRequestLocale(request.headers) || getRequestLocale(cookies);
	const body = (await request.json()) as { department?: string; note?: string };
	const rawDept = body.department ?? '';
	const note = body.note ?? '';

	if (!VALID_DEPARTMENTS.includes(rawDept as Department)) {
		return error(400, 'Đơn vị thụ lý không hợp lệ.');
	}
	const department = rawDept as Department;

	// Check document exists and is in RECEIVED state
	const doc = await db
		.prepare(
			`SELECT id, tracking_code, citizen_email, status FROM document WHERE tracking_code = ? OR id = ? LIMIT 1`
		)
		.bind(id, id)
		.first<Record<string, unknown>>();

	if (!doc) return error(404, 'Không tìm thấy hồ sơ.');
	if (doc['status'] !== 'RECEIVED') {
		return error(409, `Hồ sơ đang ở trạng thái "${doc['status']}" — không thể phân công lại.`);
	}

	const now = Math.floor(Date.now() / 1000);

	await db
		.prepare(
			`UPDATE document SET status = 'ASSIGNED', assigned_dept = ?, assigned_by = ?, assignment_note = ?, updated_at = ? WHERE id = ?`
		)
		.bind(department, locals.user.id, note, now, doc['id'])
		.run();

	// Log audit
	await db
		.prepare(
			`INSERT INTO audit_log (id, document_id, action, actor_id, actor_role, correlation_id, metadata, created_at)
		 VALUES (?, ?, 'ASSIGNED', ?, ?, ?, ?, ?)`
		)
		.bind(
			crypto.randomUUID(),
			doc['id'],
			locals.user.id,
			role,
			crypto.randomUUID(),
			JSON.stringify({ department, note }),
			now
		)
		.run();

	// Send email to citizen if we have their email
	const citizenEmail = doc['citizen_email'] as string | null;
	if (citizenEmail) {
		const deptLabel = DEPARTMENT_LABELS[department];
		const trackingCode = doc['tracking_code'] as string;
		try {
			await emailService.notifyDocumentAssigned(
				citizenEmail,
				'Quý công dân',
				trackingCode,
				deptLabel
			);
		} catch (e) {
			console.error('[assign] Failed to send email:', e);
			// Non-fatal — assignment still succeeds
		}
	}

	// Trigger AI background job
	const ctx = (platform as any)?.context;
	if (ctx?.waitUntil) {
		ctx.waitUntil(generateAISummaryJob(doc['id'] as string, db, platform, locale));
	} else if ((platform as any)?.waitUntil) {
		(platform as any).waitUntil(generateAISummaryJob(doc['id'] as string, db, platform, locale));
	} else {
		generateAISummaryJob(doc['id'] as string, db, platform, locale).catch(console.error);
	}

	return json({
		success: true,
		status: 'ASSIGNED',
		assignedDept: department,
		deptLabel: DEPARTMENT_LABELS[department]
	});
};

async function generateAISummaryJob(
	docId: string,
	db: D1Database,
	platform: App.Platform | undefined,
	locale: UILocale
) {
	if (!env.LLM_API_KEY) return;

	const openai = new OpenAI({
		apiKey: env.LLM_API_KEY,
		baseURL: env.LLM_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
	});

	let extractedDataText = '';
	let rawFileUrlStr = '';
	try {
		const row = await db
			.prepare('SELECT extracted_data, raw_file_url FROM document WHERE id = ?')
			.bind(docId)
			.first<{ extracted_data: string; raw_file_url: string }>();
		extractedDataText = row?.extracted_data ?? '';
		rawFileUrlStr = row?.raw_file_url ?? '';
	} catch (e) {
		console.error('[AI Job] Could not fetch document metadata', e);
	}

	const rawFileUrls = parseRawFileUrls(rawFileUrlStr);
	let aggregatedOcrText = '';

	// --- STEP 1: OCR / Text Extraction ---
	if (rawFileUrls.length > 0) {
		const ocrContentParts: Array<
			{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
		> = [
			{
				type: 'text',
				text: 'Hãy trích xuất toàn bộ nội dung chữ có trong tất cả các trang/tệp đính kèm theo đúng thứ tự xuất hiện. Không bỏ sót, không diễn giải, không tóm tắt.'
			}
		];

		await appendDocumentFilesAsVisionContent(ocrContentParts, rawFileUrls, platform, {
			logPrefix: 'assign-ocr',
			maxPdfPages: 10
		});

		if (ocrContentParts.length > 1) {
			try {
				const ocrResponse = await openai.chat.completions.create({
					model: 'qwen-vl-ocr-2025-11-20',
					messages: [
						{
							role: 'user',
							content: ocrContentParts
						}
					]
				});
				aggregatedOcrText = ocrResponse.choices[0]?.message?.content?.trim() || '';
			} catch (ocrErr: any) {
				console.error('[AI Job] OCR failed for uploaded files', ocrErr.message);
			}
		}
	}

	if (aggregatedOcrText.trim()) extractedDataText = aggregatedOcrText.trim();

	const prompt = `Bạn là Chuyên viên phân tích hồ sơ hành chính.
Dựa vào các thông tin sau (nếu có):
${extractedDataText}

Yêu cầu:
Viết một "Tờ trình Liên ngành" tóm tắt hồ sơ này trong đúng 3-4 dòng ngắn gọn, súc tích để trình Cán bộ xử lý. 
Nội dung nên bao gồm: Loại hồ sơ, thông tin chính yếu được cung cấp.
QUAN TRỌNG: TUYỆT ĐỐI CHỈ SỬ DỤNG thông tin có trong dữ liệu được cung cấp ở trên. KHÔNG ĐƯỢC tự bịa đặt, suy diễn, hoặc thêm bất kỳ thông tin nào bên ngoài. Không giải thích, không output thêm gì ngoài nội dung Tờ trình.
${getAiOutputInstruction(locale)}`;

	let summary = '';
	let attempts = 0;
	const maxRetries = 5;

	while (attempts < maxRetries) {
		try {
			const completion = await openai.chat.completions.create(
				{
					model: env.LLM_MODEL || 'qwen-max',
					messages: [{ role: 'user', content: prompt }]
				},
				{ timeout: 15000 }
			);
			summary = completion.choices[0]?.message?.content?.trim() || '';
			if (summary) break;
		} catch (error) {
			attempts++;
			console.error(`[AI Job] Attempt ${attempts} failed:`, error);
			if (attempts >= maxRetries) {
				summary = 'Hệ thống AI quá tải, vui lòng tổng hợp Tờ trình thủ công.';
				break;
			}
			const sleepTime = Math.floor(Math.random() * 6000) + 5000;
			await new Promise((r) => setTimeout(r, sleepTime));
		}
	}

	// Update DB
	try {
		const row = await db
			.prepare('SELECT extracted_data FROM document WHERE id = ?')
			.bind(docId)
			.first<{ extracted_data: string }>();
		let parsed: Record<string, unknown> = {};
		if (row?.extracted_data) {
			try {
				parsed = JSON.parse(row.extracted_data);
			} catch (e) {}
		}
		parsed['ai_summary'] = summary;
		parsed['ocr_extracted_text'] = extractedDataText;
		await db
			.prepare('UPDATE document SET extracted_data = ? WHERE id = ?')
			.bind(JSON.stringify(parsed), docId)
			.run();
	} catch (e) {
		console.error('[AI Job] Failed to update DB', e);
	}
}
