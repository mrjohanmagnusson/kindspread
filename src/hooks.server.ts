import type { Handle } from '@sveltejs/kit';
import { createVapidAuthHeader, encryptPayload } from '$lib/server/web-push';
import { getMissionForDay } from '$lib/missions';

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
};

/**
 * Handle scheduled cron trigger for daily push notifications
 */
export async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
	console.log('Cron triggered at:', new Date(event.scheduledTime).toISOString());

	const db = env.DB;
	if (!db) {
		console.error('Database not available');
		return;
	}

	// Get today's mission
	const { mission } = getMissionForDay();
	const payload = JSON.stringify({
		title: "Today's Kindness Mission",
		body: mission,
		icon: '/icons/icon-192.svg',
		badge: '/icons/icon-192.svg',
		tag: 'kindness-mission',
		data: { url: '/' }
	});

	// Get all active subscriptions
	const { results } = await db
		.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE active = 1')
		.all<{ endpoint: string; p256dh: string; auth: string }>();

	if (!results || results.length === 0) {
		console.log('No active subscriptions found');
		return;
	}

	console.log(`Sending notifications to ${results.length} subscribers`);

	const vapidSubject = env.VAPID_SUBJECT || 'mailto:hello@kindspread.app';

	// Send notifications
	const expiredEndpoints: string[] = [];

	await Promise.all(
		results.map(async (subscription) => {
			try {
				const encrypted = await encryptPayload(payload, subscription.p256dh, subscription.auth);

				const vapidHeaders = await createVapidAuthHeader(
					subscription.endpoint,
					vapidSubject,
					env.VAPID_PUBLIC_KEY,
					env.VAPID_PRIVATE_KEY
				);

				const response = await fetch(subscription.endpoint, {
					method: 'POST',
					headers: {
						...vapidHeaders,
						'Content-Type': 'application/octet-stream',
						'Content-Encoding': 'aes128gcm',
						'Content-Length': encrypted.byteLength.toString(),
						TTL: '86400'
					},
					body: encrypted as unknown as BodyInit
				});

				if (response.status === 410 || response.status === 404) {
					expiredEndpoints.push(subscription.endpoint);
				}
			} catch (error) {
				console.error('Push failed:', error);
			}
		})
	);

	// Mark expired subscriptions as inactive
	if (expiredEndpoints.length > 0) {
		console.log(`Marking ${expiredEndpoints.length} expired subscriptions as inactive`);
		for (const endpoint of expiredEndpoints) {
			await db
				.prepare('UPDATE push_subscriptions SET active = 0 WHERE endpoint = ?')
				.bind(endpoint)
				.run();
		}
	}

	console.log('Push notifications sent successfully');
}
