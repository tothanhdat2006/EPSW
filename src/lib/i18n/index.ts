import { browser } from '$app/environment';
import { derived, writable } from 'svelte/store';
import { enUS, vi as viLocale } from 'date-fns/locale';
import type { Cookies } from '@sveltejs/kit';

export type UILocale = 'vi' | 'en';

export const DEFAULT_LOCALE: UILocale = 'vi';
export const UI_LOCALES: UILocale[] = ['vi', 'en'];
export const LOCALE_COOKIE_NAME = 'ui_locale';

export const LOCALE_LABELS: Record<UILocale, string> = {
	vi: 'Tiếng Việt',
	en: 'English'
};

export const OUTPUT_LANGUAGE_NAMES: Record<UILocale, string> = {
	vi: 'Vietnamese',
	en: 'English'
};

export const messages = {
	vi: {
		portalArea: 'Khu vực Cán bộ',
		staffPortalTitle: 'DVC Admin Portal',
		staffPortalSubtitle: 'Đăng nhập để truy cập hệ thống quản trị',
		emailAddress: 'Địa chỉ Email',
		password: 'Mật khẩu',
		authenticating: 'Đang xác thực...',
		accessSystem: 'Truy cập hệ thống',
		backToHome: '← Về trang chủ DVC',
		testAccounts: 'Tài khoản test',
		quickFillQaAccounts: 'Điền nhanh tài khoản QA',
		testAccountHint: 'Nhấp để tự động điền email và mật khẩu. Sau đó bấm nút đăng nhập ở bên trái.',
		sharedSeedPassword: 'Tất cả tài khoản seed đang dùng cùng mật khẩu:',
		publicPortal: 'Cổng Dịch vụ Công',
		publicPortalSubtitle: 'Nộp và tra cứu hồ sơ trực tuyến',
		submitProfile: 'Nộp hồ sơ',
		trackProfile: 'Tra cứu',
		forStaff: 'Dành cho Cán bộ',
		systemOnline: 'Hệ thống DVC trực tuyến hoạt động bình thường',
		support: 'Hỗ trợ',
		email: 'Email',
		language: 'Ngôn ngữ',
		onlinePublicServicePortal: 'Cổng Dịch Vụ Công Trực Tuyến',
		submitOnlineProfile: 'Nộp Hồ Sơ Trực Tuyến',
		uploadFiles: 'Tải lên tài liệu',
		uploadFilesHint: 'Vui lòng cung cấp hồ sơ bản scan hoặc ảnh chụp rõ nét',
		filesStep: 'Tệp tin',
		contactStep: 'Liên lạc',
		submitStep: 'Gửi hồ sơ',
		uploadSuccess: 'Nộp hồ sơ thành công',
		uploadSuccessHint:
			'Hệ thống AI đang bắt đầu phân tích tập tin của bạn. Vui lòng lưu lại mã theo dõi bên dưới.',
		trackingCodeLabel: 'Mã định danh hồ sơ',
		copyTrackingCode: 'Sao chép mã',
		dataProtected: 'Thông tin của bạn được bảo mật và mã hóa theo tiêu chuẩn an ninh quốc gia.',
		submitAnother: 'Nộp thêm hồ sơ mới',
		trackStatus: 'Kiểm tra trạng thái',
		trackProfileTitle: 'Tra cứu hồ sơ',
		trackProfileHint: 'Nhập mã theo dõi để kiểm tra trạng thái hồ sơ trực tuyến',
		searching: 'Đang tìm...',
		search: 'Tra cứu',
		queryingSystem: 'Đang truy vấn hệ thống...',
		profileNotFound: 'Không tìm thấy hồ sơ',
		trackingCode: 'Mã theo dõi',
		updating: 'Đang cập nhật…',
		processingTimeline: 'Tiến trình xử lý',
		submittedAt: 'Nộp lúc',
		notAvailable: '—',
		loginFailed: 'Đăng nhập thất bại.',
		loginTitle: 'Đăng nhập Cán bộ — DVC Admin',
		publicHomeTitle: 'Nộp hồ sơ — Dịch vụ Công',
		trackTitle: 'Tra cứu hồ sơ — Cổng Dịch vụ Công',
		adminWorkspace: 'Workspace thông minh',
		overview: 'Tổng quan',
		oneStop: 'Một cửa',
		operations: 'Xử lý nghiệp vụ',
		administration: 'Quản trị',
		dashboard: 'Dashboard',
		receptionQueue: 'Tiếp nhận hồ sơ',
		reviewQueue: 'Kiểm duyệt hồ sơ',
		leadershipApproval: 'Phê duyệt Lãnh đạo',
		userManagement: 'Quản lý nhân sự',
		defaultStaffName: 'Cán bộ',
		signOut: 'Đăng xuất hệ thống',
		adminPlatformTitle: 'Nền tảng Quản trị thông minh — DVC',
		notFoundProfile: 'Hồ sơ không tồn tại',
		notFoundProfileHint:
			'Vui lòng chọn hồ sơ từ danh sách để xem chi tiết hoặc kiểm tra lại đường dẫn.',
		backToDashboard: 'Quay lại Dashboard'
	},
	en: {
		portalArea: 'Staff Area',
		staffPortalTitle: 'DVC Admin Portal',
		staffPortalSubtitle: 'Sign in to access the administration workspace',
		emailAddress: 'Email Address',
		password: 'Password',
		authenticating: 'Authenticating...',
		accessSystem: 'Access System',
		backToHome: '← Back to DVC home',
		testAccounts: 'Test accounts',
		quickFillQaAccounts: 'Quick-fill QA accounts',
		testAccountHint:
			'Click to fill the email and password automatically, then press the login button on the left.',
		sharedSeedPassword: 'All seed accounts use the same password:',
		publicPortal: 'Public Service Portal',
		publicPortalSubtitle: 'Submit and track records online',
		submitProfile: 'Submit',
		trackProfile: 'Track',
		forStaff: 'Staff access',
		systemOnline: 'The online DVC system is operating normally',
		support: 'Support',
		email: 'Email',
		language: 'Language',
		onlinePublicServicePortal: 'Online Public Service Portal',
		submitOnlineProfile: 'Submit Records Online',
		uploadFiles: 'Upload Documents',
		uploadFilesHint: 'Please provide clear scans or photos of your documents',
		filesStep: 'Files',
		contactStep: 'Contact',
		submitStep: 'Submit',
		uploadSuccess: 'Submission successful',
		uploadSuccessHint:
			'The AI system is starting to analyze your files. Please keep the tracking code below.',
		trackingCodeLabel: 'Record identifier',
		copyTrackingCode: 'Copy code',
		dataProtected:
			'Your information is protected and encrypted according to national security standards.',
		submitAnother: 'Submit another record',
		trackStatus: 'Check Status',
		trackProfileTitle: 'Track record',
		trackProfileHint: 'Enter your tracking code to check the online processing status',
		searching: 'Searching...',
		search: 'Search',
		queryingSystem: 'Querying the system...',
		profileNotFound: 'Record not found',
		trackingCode: 'Tracking Code',
		updating: 'Updating…',
		processingTimeline: 'Processing timeline',
		submittedAt: 'Submitted at',
		notAvailable: '—',
		loginFailed: 'Sign-in failed.',
		loginTitle: 'Staff Login — DVC Admin',
		publicHomeTitle: 'Submit records — Public Service',
		trackTitle: 'Track records — Public Service Portal',
		adminWorkspace: 'Smart workspace',
		overview: 'Overview',
		oneStop: 'One-stop desk',
		operations: 'Operations',
		administration: 'Administration',
		dashboard: 'Dashboard',
		receptionQueue: 'Reception queue',
		reviewQueue: 'Review queue',
		leadershipApproval: 'Leadership approval',
		userManagement: 'User management',
		defaultStaffName: 'Staff member',
		signOut: 'Sign out',
		adminPlatformTitle: 'Smart Administration Platform — DVC',
		notFoundProfile: 'Record does not exist',
		notFoundProfileHint: 'Select a record from the list to view details, or check the URL again.',
		backToDashboard: 'Back to Dashboard'
	}
} as const;

export type TranslationKey = keyof (typeof messages)[typeof DEFAULT_LOCALE];

function normalizeLocale(value: string | null | undefined): UILocale {
	return value === 'en' ? 'en' : DEFAULT_LOCALE;
}

export function getRequestLocale(
	input: Request | Headers | Cookies | string | null | undefined
): UILocale {
	if (!input) return DEFAULT_LOCALE;
	if (typeof input === 'string') return normalizeLocale(input);
	if ('get' in input) {
		const headerLocale = input.get('x-ui-locale') ?? input.get(LOCALE_COOKIE_NAME) ?? null;
		if (headerLocale) return normalizeLocale(headerLocale);
		const cookieHeader = input.get('cookie');
		if (cookieHeader) {
			const match = cookieHeader.match(new RegExp(`${LOCALE_COOKIE_NAME}=([^;]+)`));
			if (match?.[1]) return normalizeLocale(decodeURIComponent(match[1]));
		}
	}
	return DEFAULT_LOCALE;
}

export function getDateLocale(locale: UILocale) {
	return locale === 'en' ? enUS : viLocale;
}

export function getAiOutputInstruction(locale: UILocale) {
	return locale === 'en'
		? 'Output language requirement: respond entirely in English.'
		: 'Yêu cầu ngôn ngữ đầu ra: trả lời hoàn toàn bằng tiếng Việt.';
}

export const locale = writable<UILocale>(DEFAULT_LOCALE);
export const currentMessages = derived(locale, ($locale) => messages[$locale]);

export function translate(localeValue: UILocale, key: TranslationKey): string {
	return messages[localeValue][key] ?? messages[DEFAULT_LOCALE][key] ?? key;
}

export function setLocale(localeValue: UILocale) {
	const normalized = normalizeLocale(localeValue);
	locale.set(normalized);
	if (!browser) return;
	document.documentElement.lang = normalized;
	localStorage.setItem(LOCALE_COOKIE_NAME, normalized);
	document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(normalized)}; path=/; max-age=31536000; samesite=lax`;
}

export function initializeLocale() {
	if (!browser) return;
	const stored = normalizeLocale(localStorage.getItem(LOCALE_COOKIE_NAME));
	setLocale(stored);
}
