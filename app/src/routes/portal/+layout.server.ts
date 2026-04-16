import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// If this is the login page, skip the auth check
	if (url.pathname === '/portal/login') {
		// If already logged in, redirect to dashboard
		if (locals.user) {
			redirect(302, '/portal');
		}
		return {};
	}

	// Guard: all other /portal routes require authentication
	if (!locals.user) {
		redirect(302, `/portal/login?redirectTo=${encodeURIComponent(url.pathname)}`);
	}

	return {
		user: locals.user,
		session: locals.session
	};
};
