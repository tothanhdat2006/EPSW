import { config } from '../config.js';

export async function sendZaloMessage(recipientZaloId: string, message: string): Promise<void> {
  const response = await fetch(config.zalo.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      access_token: config.zalo.oaAccessToken,
    },
    body: JSON.stringify({
      recipient: { user_id: recipientZaloId },
      message: { text: message },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Zalo OA API error ${response.status}: ${body}`);
  }
}
