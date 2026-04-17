import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { emailService } from '$lib/server/email-service';
import { env } from '$env/dynamic/private';
import OpenAI from 'openai';

function getDB(platform: App.Platform | undefined) {
	return (platform?.env as Record<string, unknown> | undefined)?.['DB'] as D1Database | undefined;
}

type LeadershipDecision = 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';

async function generateLeadershipFeedbackWithAI(
	decision: LeadershipDecision,
	extractedData: Record<string, unknown>
): Promise<string | null> {
	if (!env.LLM_API_KEY) return null;

	const openai = new OpenAI({
		apiKey: env.LLM_API_KEY,
		baseURL: env.LLM_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
	});

	const model = env.LLM_MODEL || 'qwen-plus';
	const aiSummary = typeof extractedData.ai_summary === 'string' ? extractedData.ai_summary : '';
	const officerBrief = typeof extractedData.ai_officer_brief === 'string' ? extractedData.ai_officer_brief : '';
	const officerFeedbacks = Array.isArray(extractedData.officerFeedback)
		? extractedData.officerFeedback as Array<Record<string, unknown>>
		: [];
	const latestOfficerFeedback = officerFeedbacks.length > 0
		? String(officerFeedbacks[officerFeedbacks.length - 1]?.feedback ?? '')
		: '';

	const instructionByDecision: Record<LeadershipDecision, string> = {
		APPROVED: 'Soạn 1 câu đồng ý phê duyệt ngắn gọn, dứt khoát.',
		REJECTED: 'Soạn 2-3 câu từ chối hồ sơ, nêu rõ lý do trọng tâm và lịch sự.',
		REVISION_REQUESTED: 'Soạn 2-3 câu yêu cầu bổ sung/sửa đổi hồ sơ với các điểm cần làm rõ.'
	};

	const systemPrompt = `Bạn là Lãnh đạo cơ quan nhà nước.
Mục tiêu: đưa ra chỉ đạo ngắn gọn, rõ ràng, đúng vai trò lãnh đạo.
Yêu cầu:
- Bắt đầu thẳng vào ý chính, không chào hỏi.
- Dùng tiếng Việt hành chính dễ hiểu, dứt khoát, đúng mực.
- Không dùng markdown, không gạch đầu dòng.
- Chỉ trả về đúng nội dung chỉ đạo, không thêm giải thích ngoài lề.`;

	const userPrompt = `Thông tin hồ sơ:
- Tóm tắt AI: ${aiSummary || '(không có)'}
- Báo cáo của chuyên viên: ${officerBrief || '(không có)'}
- Ý kiến chuyên môn gần nhất: ${latestOfficerFeedback || '(không có)'}

Nhiệm vụ: ${instructionByDecision[decision]}`;

	try {
		const completion = await openai.chat.completions.create(
			{
				model,
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: userPrompt }
				]
			},
			{ timeout: 30000, maxRetries: 1 }
		);

		const content = completion.choices[0]?.message?.content?.trim();
		return content || null;
	} catch (e) {
		console.error('[approve] AI feedback generation failed:', e);
		return null;
	}
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
	const body = await request.json() as { decision?: string; feedback?: string; autoGenerateFeedback?: boolean };
	const rawDecision = body.decision ?? 'APPROVED';
	// Lãnh đạo can decide APPROVED, REJECTED, or REVISION_REQUESTED
	const decision: LeadershipDecision = (rawDecision === 'REJECTED' || rawDecision === 'REVISION_REQUESTED') ? rawDecision : 'APPROVED';
	let feedback = body.feedback ?? '';

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

	let feedbackGeneratedByAI = false;
	const shouldAutoGenerateFeedback = body.autoGenerateFeedback === true || !feedback.trim();
	if (shouldAutoGenerateFeedback) {
		const aiFeedback = await generateLeadershipFeedbackWithAI(decision, extractedData);
		if (aiFeedback) {
			feedback = aiFeedback;
			feedbackGeneratedByAI = true;
		}
	}

	if ((decision === 'REJECTED' || decision === 'REVISION_REQUESTED') && !feedback.trim()) {
		return error(400, 'Vui lòng nêu rõ lý do hoặc bật AI để tạo nội dung phản hồi.');
	}

	extractedData.leadershipFeedback = extractedData.leadershipFeedback || [];
	extractedData.leadershipFeedback.push({
		officer: name,
		role,
		decision,
		feedback,
		generatedByAI: feedbackGeneratedByAI,
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
		JSON.stringify({ decision, feedback, generatedByAI: feedbackGeneratedByAI }),
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
