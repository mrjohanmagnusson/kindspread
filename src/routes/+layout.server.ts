import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ request, platform }) => {
	const cf = platform?.cf as { country?: string } | undefined;
	const country = cf?.country || request.headers.get('cf-ipcountry') || null;

	// Check Accept-Language header for Swedish
	const acceptLang = request.headers.get('accept-language') || '';
	const prefersSv = acceptLang.toLowerCase().startsWith('sv');

	return {
		locale: {
			country,
			prefersSv
		}
	};
};
