import { redirect, error } from '@sveltejs/kit';
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

	const role = (locals.user as any).role as string;
	const path = url.pathname;

	// Redirections based on roles
	if (path === '/portal' && role === 'mot_cua') {
		redirect(302, '/portal/reception');
	}

	// Role-based route guards
	if (path.startsWith('/portal/reception') && !['admin', 'mot_cua'].includes(role)) {
		error(403, 'Bạn không có quyền truy cập trang Tiếp nhận hồ sơ.');
	}
	if (path.startsWith('/portal/review') && !['admin', 'chuyen_vien'].includes(role)) {
		error(403, 'Bạn không có quyền truy cập trang Kiểm duyệt hồ sơ.');
	}
	if (path.startsWith('/portal/approval') && !['admin', 'lanh_dao'].includes(role)) {
		error(403, 'Bạn không có quyền truy cập trang Phê duyệt Lãnh đạo.');
	}
	if (path.startsWith('/portal/users') && role !== 'admin') {
		error(403, 'Bạn không có quyền truy cập trang Quản lý nhân sự.');
	}

	return {
		user: locals.user,
		session: locals.session
	};
};
