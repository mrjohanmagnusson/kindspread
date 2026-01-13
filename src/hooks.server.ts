import type { Handle } from '@sveltejs/kit';
import { handleScheduled } from '$lib/server/scheduled-handler';

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
};

/**
 * Cloudflare Workers scheduled handler for cron triggers
 * This is exported at the module level and picked up by the Cloudflare adapter
 */
export { handleScheduled as scheduled };

