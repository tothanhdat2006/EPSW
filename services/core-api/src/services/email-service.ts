import { Resend } from 'resend';
import { createLogger } from '@dvc/logger';
import { config } from '../config.js';

const logger = createLogger({ service: 'email-service' });

let resendClient: Resend | null = null;

function getResend() {
	if (!resendClient) {
		const apiKey = process.env.RESEND_API_KEY || config.llm.apiKey; // Fallback or specific key
		resendClient = new Resend(apiKey);
	}
	return resendClient;
}

export const emailService = {
	async sendEmail(to: string, subject: string, html: string) {
		try {
			const resend = getResend();
			const { data, error } = await resend.emails.send({
				from: 'DVC <dvc-no-reply@mncuchiinhuttt.dev>',
				to: [to],
				subject,
				html
			});

			if (error) {
				logger.error({ error, to, subject }, 'Failed to send email via Resend');
				return { success: false, error };
			}

			logger.info({ id: data?.id, to, subject }, 'Email sent successfully');
			return { success: true, data };
		} catch (err) {
			logger.error({ err, to, subject }, 'Unexpected error sending email');
			return { success: false, error: err };
		}
	},

	async notifyDocumentReceived(to: string, name: string, trackingCode: string) {
		const subject = `[DVC] Xác nhận tiếp nhận hồ sơ ${trackingCode}`;
		const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2563eb;">Chào ${name},</h2>
        <p>Hồ sơ của bạn đã được tiếp nhận thành công trên hệ thống Dịch vụ công.</p>
        <div style="background: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
          <strong>Mã tra cứu:</strong> <code style="font-size: 1.2em; color: #1e40af;">${trackingCode}</code>
        </div>
        <p>Bạn có thể sử dụng mã này để tra cứu trạng thái xử lý tại trang web của chúng tôi.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 0.8em; color: #64748b;">Đây là email tự động, vui lòng không trả lời.</p>
      </div>
    `;
		return this.sendEmail(to, subject, html);
	},

	async notifyDocumentApproved(to: string, name: string, trackingCode: string) {
		const subject = `[DVC] Thông báo kết quả phê duyệt hồ sơ ${trackingCode}`;
		const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #059669;">Chúc mừng ${name}!</h2>
        <p>Hồ sơ <strong>${trackingCode}</strong> của bạn đã được <strong>PHÊ DUYỆT</strong>.</p>
        <p>Kết quả chính thức đã được phát hành. Bạn có thể đăng nhập vào cổng thông tin để tải về hoặc nhận tại bộ phận một cửa.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 0.8em; color: #64748b;">Đây là email tự động, vui lòng không trả lời.</p>
      </div>
    `;
		return this.sendEmail(to, subject, html);
	},

	async notifyDocumentRejected(to: string, name: string, trackingCode: string, reason: string) {
		const subject = `[DVC] Thông báo kết quả xử lý hồ sơ ${trackingCode}`;
		const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #dc2626;">Chào ${name},</h2>
        <p>Chúng tôi rất tiếc phải thông báo hồ sơ <strong>${trackingCode}</strong> của bạn đã bị <strong>TỪ CHỐI</strong> hoặc yêu cầu bổ sung.</p>
        <div style="background: #fef2f2; padding: 15px; border-left: 4px solid #dc2626; margin: 20px 0;">
          <strong>Lý do:</strong> ${reason}
        </div>
        <p>Vui lòng cập nhật hồ sơ theo hướng dẫn và nộp lại.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 0.8em; color: #64748b;">Đây là email tự động, vui lòng không trả lời.</p>
      </div>
    `;
		return this.sendEmail(to, subject, html);
	}
};
