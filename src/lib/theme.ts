export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';

function isTheme(value: string | null): value is Theme {
	return value === 'light' || value === 'dark';
}

export function getSystemTheme(): Theme {
	if (typeof window === 'undefined') return 'dark';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(): Theme {
	if (typeof window === 'undefined') return 'dark';

	const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
	if (isTheme(storedTheme)) return storedTheme;

	return getSystemTheme();
}

export function applyTheme(theme: Theme): void {
	if (typeof document === 'undefined') return;

	const root = document.documentElement;
	root.classList.toggle('dark', theme === 'dark');
	root.classList.toggle('light', theme === 'light');
	root.setAttribute('data-theme', theme);
}

export function setTheme(theme: Theme): void {
	applyTheme(theme);

	if (typeof window !== 'undefined') {
		window.localStorage.setItem(THEME_STORAGE_KEY, theme);
	}
}

export function initializeTheme(): Theme {
	const theme = resolveTheme();
	applyTheme(theme);
	return theme;
}
