import nodemailer from 'nodemailer';
import { config } from '../config.js';

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

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
): Promise<void> {
  const mail = getTransporter();
  await mail.sendMail({
    from: config.smtp.from,
    to,
    subject,
    html: htmlBody,
  });
}
