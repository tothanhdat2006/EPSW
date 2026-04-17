import { sendEmail } from './resend';
import * as templates from './email-templates';

/**
 * High-level Email Service for the DVC Portal.
 * Handles selecting the correct template and sending the email.
 */
export const emailService = {
	/**
	 * Send notification when a citizen successfully submits a document.
	 */
	async notifyDocumentReceived(to: string, name: string, trackingCode: string) {
		const html = templates.getReceivedTemplate(name, trackingCode);
		return await sendEmail({
			to,
			subject: `[DVC] Xác nhận tiếp nhận Hồ sơ #${trackingCode}`,
			html
		});
	},

	/**
	 * Send notification when a document is officially approved by leadership.
	 */
	async notifyDocumentApproved(to: string, name: string, trackingCode: string) {
		const html = templates.getApprovedTemplate(name, trackingCode);
		return await sendEmail({
			to,
			subject: `[DVC] Thông báo kết quả: Hồ sơ #${trackingCode} ĐÃ PHÊ DUYỆT`,
			html
		});
	},

	/**
	 * Send notification when a document is rejected.
	 */
	async notifyDocumentRejected(to: string, name: string, trackingCode: string, reason: string) {
		const html = templates.getRejectedTemplate(name, trackingCode, reason);
		return await sendEmail({
			to,
			subject: `[DVC] Thông báo kết quả: Hồ sơ #${trackingCode}`,
			html
		});
	},

	/**
	 * Send notification when Bộ phận Một cửa assigns the document to a department.
	 * This is the "official reception" confirmation the citizen receives.
	 */
	async notifyDocumentAssigned(to: string, name: string, trackingCode: string, deptLabel: string) {
		const html = templates.getAssignedTemplate(name, trackingCode, deptLabel);
		return await sendEmail({
			to,
			subject: `[DVC] Hồ sơ #${trackingCode} đã được tiếp nhận và phân công xử lý`,
			html
		});
	}
};
