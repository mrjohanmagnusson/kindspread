import { browser } from '$app/environment';
import { en } from './en';
import { sv } from './sv';

export type Locale = 'en' | 'sv';
export type Translations = typeof en;

const translations: Record<Locale, Translations> = { en, sv };

let currentLocale: Locale = 'en';

const STORAGE_KEY = 'kindspread-locale';

/**
 * Detect initial locale from country code, Accept-Language, or stored preference.
 */
export function detectLocale(country?: string | null): Locale {
	// Check stored preference first
	if (browser) {
		const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
		if (stored && translations[stored]) return stored;
	}

	// Swedish-speaking countries (Cloudflare sends ISO country codes like "SE")
	if (country && country.toUpperCase() === 'SE') {
		return 'sv';
	}

	// Check browser language
	if (browser && navigator.language.startsWith('sv')) {
		return 'sv';
	}

	return 'en';
}

export function initLocale(country?: string | null): void {
	currentLocale = detectLocale(country);
}

export function getLocale(): Locale {
	return currentLocale;
}

export function setLocale(locale: Locale): void {
	currentLocale = locale;
	if (browser) {
		localStorage.setItem(STORAGE_KEY, locale);
		window.dispatchEvent(new CustomEvent('localeChange', { detail: locale }));
	}
}

export function t(): Translations {
	return translations[currentLocale];
}

export { en, sv };
