/**
 * High-fidelity HTML Email Templates for the DVC Portal.
 * Uses a premium Dark Mode Glassmorphism aesthetic.
 */

const LOGO_URL = 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/brain-circuit.png';
const APP_NAME = 'Hệ thống Quản trị DVC';
const APP_URL = 'http://localhost:5173'; // Should be replaced with env.ORIGIN in future

function getBaseTemplate(content: string, title: string) {
	return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
            
            body {
                margin: 0;
                padding: 0;
                background-color: #030712;
                font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #f8fafc;
            }

            .wrapper {
                width: 100%;
                table-layout: fixed;
                background-color: #030712;
                padding: 40px 0;
            }

            .container {
                max-width: 600px;
                margin: 0 auto;
                background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 32px;
                overflow: hidden;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            }

            .header {
                padding: 40px;
                text-align: center;
                background: linear-gradient(to bottom, rgba(59, 130, 246, 0.1), transparent);
            }

            .logo {
                width: 48px;
                height: 48px;
                margin-bottom: 16px;
            }

            .title {
                font-size: 28px;
                font-weight: 800;
                margin: 0;
                background: linear-gradient(to right, #ffffff, #94a3b8);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                letter-spacing: -0.02em;
            }

            .content {
                padding: 0 40px 40px;
                line-height: 1.6;
                color: #cbd5e1;
            }

            .status-card {
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 20px;
                padding: 24px;
                margin: 24px 0;
            }

            .tracking-code {
                font-family: 'JetBrains Mono', monospace;
                font-size: 18px;
                font-weight: 700;
                color: #3b82f6;
                letter-spacing: 0.1em;
                margin-top: 8px;
            }

            .button {
                display: inline-block;
                padding: 16px 32px;
                background-color: #3b82f6;
                color: #ffffff;
                text-decoration: none;
                border-radius: 16px;
                font-weight: 600;
                margin-top: 24px;
                box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);
            }

            .footer {
                padding: 32px;
                text-align: center;
                font-size: 12px;
                color: #64748b;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
            }

            .accent-line {
                height: 4px;
                width: 100%;
                background: linear-gradient(to right, #3b82f6, #8b5cf6);
            }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="container">
                <div class="accent-line"></div>
                <div class="header">
                    <img src="${LOGO_URL}" alt="Logo" class="logo">
                    <h1 class="title">${title}</h1>
                </div>
                <div class="content">
                    ${content}
                    <div style="text-align: center;">
                        <a href="${APP_URL}/track" class="button">Theo dõi tiến độ</a>
                    </div>
                </div>
                <div class="footer">
                    <p>&copy; 2026 ${APP_NAME}. Đây là email tự động, vui lòng không trả lời.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

export function getReceivedTemplate(name: string, trackingCode: string) {
	const content = `
        <p>Kính chào <strong>${name}</strong>,</p>
        <p>Chúng tôi đã tiếp nhận hồ sơ của bạn trên hệ thống DVC. Hồ sơ đang được AI xử lý sơ bộ và định tuyến đến phòng ban chuyên trách.</p>
        <div class="status-card">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b;">Mã hồ sơ</div>
            <div class="tracking-code">${trackingCode}</div>
        </div>
        <p>Bạn sẽ nhận được thông báo tiếp theo sau khi hồ sơ hoàn tất giai đoạn phân tích tự động.</p>
    `;
	return getBaseTemplate(content, 'Hồ sơ đã được tiếp nhận');
}

export function getApprovedTemplate(name: string, trackingCode: string) {
	const content = `
        <p>Xin chúc mừng <strong>${name}</strong>,</p>
        <p>Hồ sơ của bạn đã hoàn tất quá trình kiểm duyệt và được <strong>phê duyệt chính thức</strong>.</p>
        <div class="status-card" style="border-left: 4px solid #10b981; background: rgba(16, 185, 129, 0.05);">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #10b981; font-weight: 700;">Trạng thái: Đã phê duyệt</div>
            <div class="tracking-code" style="color: #ffffff;">${trackingCode}</div>
        </div>
        <p>Kết quả chi tiết đã được gửi đến tài khoản của bạn. Vui lòng nhấn vào nút bên dưới để xem hoặc tải về.</p>
    `;
	return getBaseTemplate(content, 'Hồ sơ đã được Phê duyệt');
}

export function getRejectedTemplate(name: string, trackingCode: string, reason: string) {
	const content = `
        <p>Kính chào <strong>${name}</strong>,</p>
        <p>Chúng tôi rất tiếc phải thông báo rằng hồ sơ của bạn <strong>không được phê duyệt</strong> trong đợt kiểm duyệt này.</p>
        <div class="status-card" style="border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.05);">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #ef4444; font-weight: 700;">Trạng thái: Từ chối</div>
            <div class="tracking-code" style="color: #ffffff;">${trackingCode}</div>
            <p style="margin-top: 16px; font-size: 14px; color: #94a3b8;"><strong>Lý do:</strong> ${reason}</p>
        </div>
        <p>Bạn có thể điều chỉnh hồ sơ dựa trên lý do nêu trên và nộp lại yêu cầu mới bất cứ lúc nào.</p>
    `;
	return getBaseTemplate(content, 'Thông báo kết quả Hồ sơ');
}

export function getAssignedTemplate(name: string, trackingCode: string, deptLabel: string) {
	const content = `
        <p>Kính chào <strong>${name}</strong>,</p>
        <p>Chúng tôi xác nhận hồ sơ của bạn đã được <strong>Bộ phận Một cửa</strong> tiếp nhận chính thức và chuyển đến đơn vị chuyên trách để xử lý.</p>
        <div class="status-card" style="border-left: 4px solid #3b82f6; background: rgba(59, 130, 246, 0.05);">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #3b82f6; font-weight: 700;">Đã phân công xử lý</div>
            <div class="tracking-code">${trackingCode}</div>
            <p style="margin-top: 16px; font-size: 14px; color: #94a3b8;">
                <strong>Đơn vị thụ lý:</strong> ${deptLabel}
            </p>
        </div>
        <p>Bộ phận chuyên trách sẽ tiến hành thẩm tra và xử lý hồ sơ theo đúng quy trình. Bạn có thể theo dõi tiến độ bằng mã hồ sơ bên trên.</p>
    `;
	return getBaseTemplate(content, 'Hồ sơ đã được tiếp nhận');
}
