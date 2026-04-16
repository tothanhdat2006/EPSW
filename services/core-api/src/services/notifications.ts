import nodemailer from 'nodemailer';
import { createLogger } from '@dvc/logger';
import { config } from '../config.js';

const logger = createLogger({ service: 'core-api' });

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (!config.smtp.user || !config.smtp.pass) {
    logger.warn({ to, subject }, 'SMTP is not configured; skipping email send');
    return;
  }

  const mail = getTransporter();
  await mail.sendMail({
    from: config.smtp.from,
    to,
    subject,
    html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
  });
}

export async function sendSms(phone: string, message: string): Promise<void> {
  if (!config.sms.apiKey) {
    logger.warn({ phone }, 'SMS gateway is not configured; skipping SMS send');
    return;
  }

  const response = await fetch(config.sms.gatewayUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.sms.apiKey}`,
    },
    body: JSON.stringify({ to: phone, message }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SMS send failed (${response.status}): ${text}`);
  }
}

export async function sendZalo(userId: string, message: string): Promise<void> {
  if (!config.zalo.oaAccessToken) {
    logger.warn({ userId }, 'Zalo is not configured; skipping Zalo send');
    return;
  }

  const response = await fetch(config.zalo.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      access_token: config.zalo.oaAccessToken,
    },
    body: JSON.stringify({
      recipient: { user_id: userId },
      message: { text: message },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zalo send failed (${response.status}): ${text}`);
  }
}
