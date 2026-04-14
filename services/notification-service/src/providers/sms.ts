import { config } from '../config.js';

export async function sendSms(phoneNumber: string, message: string): Promise<void> {
  const response = await fetch(config.sms.gatewayUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.sms.apiKey}`,
    },
    body: JSON.stringify({
      to: phoneNumber,
      message,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SMS gateway error ${response.status}: ${body}`);
  }
}
