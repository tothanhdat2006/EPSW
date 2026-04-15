import OpenAI from 'openai';
import { config } from '../config.js';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.baseUrl,
    });
  }
  return client;
}

/**
 * Generate an executive summary of a document for leadership review.
 * Uses retry logic as required by INSTRUCTIONS.md.
 */
export async function generateApprovalSummary(
  extractedData: Record<string, unknown>,
  trackingCode: string,
): Promise<string> {
  const openai = getClient();

  const prompt = `Bạn là trợ lý hành chính. Tóm tắt hồ sơ sau đây trong 3-5 câu ngắn gọn cho Lãnh đạo phê duyệt.
Mã hồ sơ: ${trackingCode}
Dữ liệu hồ sơ: ${JSON.stringify(extractedData, null, 2)}

Tóm tắt:`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: config.llm.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
      });
      return response.choices[0]?.message?.content ?? 'Không thể tạo tóm tắt tự động.';
    } catch (err) {
      if (attempt === 3) {
        return `Hồ sơ ${trackingCode} cần được phê duyệt. (Tóm tắt tự động không khả dụng)`;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  return `Hồ sơ ${trackingCode} cần được phê duyệt.`;
}

/**
 * Translate a rejection reason from leadership into actionable instructions for the secretary.
 * This is the "LLM phân tích lý do & Định tuyến" step from the workflow diagram.
 */
export async function translateRejectionReason(
  rejectionReason: string,
  documentType: string,
  trackingCode: string,
): Promise<{ translatedReason: string; routeTo: string }> {
  const openai = getClient();

  const prompt = `Bạn là trợ lý hành chính. Lãnh đạo từ chối hồ sơ với lý do sau.
Hãy:
1. Dịch lý do thành hướng dẫn cụ thể cho Thư ký/Chuyên viên
2. Xác định phòng ban hoặc chuyên viên cần xử lý tiếp

Loại hồ sơ: ${documentType}
Mã hồ sơ: ${trackingCode}
Lý do từ chối: ${rejectionReason}

Trả về JSON với fields: translatedReason (string), routeTo (string - tên phòng ban hoặc vai trò)`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: config.llm.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(content);
      return {
        translatedReason: parsed.translatedReason ?? rejectionReason,
        routeTo: parsed.routeTo ?? 'THU_KY',
      };
    } catch {
      if (attempt === 3) {
        return { translatedReason: rejectionReason, routeTo: 'THU_KY' };
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  return { translatedReason: rejectionReason, routeTo: 'THU_KY' };
}
