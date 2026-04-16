import { Resend } from 'resend';

let _resend: Resend;

const getResendClient = async () => {
	if (_resend) return _resend;

	let apiKey = process.env.RESEND_API_KEY;

	try {
		const svelte_env = await import('$env/dynamic/private');
		apiKey = svelte_env.env.RESEND_API_KEY || apiKey;
	} catch (e) {
		// Ignore error if $env is not available (e.g. in standalone scripts)
	}

	if (!apiKey) {
		throw new Error('RESEND_API_KEY is missing');
	}

	_resend = new Resend(apiKey);
	return _resend;
};

export interface SendEmailOptions {
	to: string | string[];
	subject: string;
	html: string;
	from?: string;
}

/**
 * Standardized email sender for the DVC Portal.
 * Defaults to the no-reply address provided by the user.
 */
export async function sendEmail({
	to,
	subject,
	html,
	from = 'DVC No Reply <dvc-no-reply@mncuchiinhuttt.dev>'
}: SendEmailOptions) {
	try {
		const resend = await getResendClient();

		const { data, error } = await resend.emails.send({
			from,
			to,
			subject,
			html
		});

		if (error) {
			console.error('❌ Resend error:', error);
			return { success: false, error };
		}

		return { success: true, data };
	} catch (e: any) {
		console.error('❌ Failed to send email:', e);
		return { success: false, error: e.message || e };
	}
}
