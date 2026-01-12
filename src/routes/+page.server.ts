import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ request, platform }) => {
	// Cloudflare provides geolocation data via the cf object on the request
	// When running on Cloudflare Workers/Pages, platform.cf contains this data
	const cf = platform?.cf as
		| {
				city?: string;
				country?: string;
				latitude?: string;
				longitude?: string;
				region?: string;
				timezone?: string;
		  }
		| undefined;

	// Fallback to headers if cf object is not available
	const city = cf?.city || request.headers.get('cf-ipcity');
	const country = cf?.country || request.headers.get('cf-ipcountry');
	const latitude = cf?.latitude ? parseFloat(cf.latitude) : null;
	const longitude = cf?.longitude ? parseFloat(cf.longitude) : null;
	const region = cf?.region;
	const timezone = cf?.timezone;

	return {
		estimatedLocation: {
			city: city || null,
			country: country || null,
			latitude,
			longitude,
			region: region || null,
			timezone: timezone || null
		}
	};
};
