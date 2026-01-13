/**
 * Scheduled handler for Cloudflare Workers cron triggers
 * Sends daily push notifications with today's kindness mission
 */

import { getMissionForDay } from '$lib/missions';
import { createVapidAuthHeader, encryptPayload } from './web-push';

interface PushSubscription {
	endpoint: string;
	p256dh: string;
	auth: string;
}

interface Env {
	DB: D1Database;
	VAPID_PUBLIC_KEY: string;
	VAPID_PRIVATE_KEY: string;
	VAPID_SUBJECT: string;
}

/**
 * Handle scheduled cron events
 */
export async function handleScheduled(
	event: ScheduledEvent,
	env: Env,
	ctx: ExecutionContext
): Promise<void> {
	console.log(`Cron triggered at ${new Date(event.scheduledTime).toISOString()}`);

	const db = env.DB;
	if (!db) {
		console.error('Database not configured');
		return;
	}

	const vapidPublicKey = env.VAPID_PUBLIC_KEY;
	const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
	const vapidSubject = env.VAPID_SUBJECT || 'mailto:hello@kindspread.com';

	if (!vapidPublicKey || !vapidPrivateKey) {
		console.error('VAPID keys not configured');
		return;
	}

	// Get today's mission from the shared missions source
	const { mission } = getMissionForDay(new Date());

	// Get all active subscriptions
	const { results } = await db
		.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE active = 1')
		.all<PushSubscription>();

	if (!results || results.length === 0) {
		console.log('No active subscriptions found');
		return;
	}

	console.log(`Sending notifications to ${results.length} subscribers`);

	const payload = JSON.stringify({
		title: 'Your Daily Kindness Mission',
		body: mission,
		icon: '/icons/icon-192.svg',
		badge: '/icons/icon-192.svg',
		tag: 'daily-mission',
		data: { url: '/' }
	});

	let successCount = 0;
	let failCount = 0;

	// Process subscriptions in parallel with a concurrency limit
	const sendNotification = async (subscription: PushSubscription): Promise<void> => {
		try {
			const encrypted = await encryptPayload(payload, subscription.p256dh, subscription.auth);

			const vapidHeaders = await createVapidAuthHeader(
				subscription.endpoint,
				vapidSubject,
				vapidPublicKey,
				vapidPrivateKey
			);

			const response = await fetch(subscription.endpoint, {
				method: 'POST',
				headers: {
					...vapidHeaders,
					'Content-Type': 'application/octet-stream',
					'Content-Encoding': 'aes128gcm',
					'Content-Length': encrypted.byteLength.toString(),
					TTL: '86400' // 24 hours
				},
				body: encrypted as unknown as BodyInit
			});

			if (response.ok) {
				successCount++;
			} else {
				failCount++;
				// If subscription is expired/invalid, mark as inactive
				if (response.status === 410 || response.status === 404) {
					await db
						.prepare('UPDATE push_subscriptions SET active = 0 WHERE endpoint = ?')
						.bind(subscription.endpoint)
						.run();
				}
			}
		} catch (error) {
			failCount++;
			console.error(`Failed to send to subscription: ${error}`);
		}
	};

	// Use waitUntil to ensure all notifications are sent
	ctx.waitUntil(
		Promise.all(results.map(sendNotification)).then(() => {
			console.log(`Notifications sent: ${successCount} success, ${failCount} failed`);
		})
	);
}

