import type { Handle } from '@sveltejs/kit';
import { createVapidAuthHeader, encryptPayload } from '$lib/server/web-push';

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
};

// Missions for daily notifications
const missions = [
	'Tell someone you know that you are proud of them',
	'Tell someone you know why you are thankful for them',
	'Send a kind message to someone you have not talked to in a while',
	'Give a genuine compliment to a stranger',
	'Write a thank you note to someone who helped you recently',
	'Share something positive on social media',
	'Offer to help a colleague or friend with something'
];

/**
 * Get today's mission based on the date
 */
function getTodaysMission(): string {
	const today = new Date();
	const dayOfYear = Math.floor(
		(today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
	);
	return missions[dayOfYear % missions.length];
}

/**
 * Send push notification using Web Push protocol
 */
async function sendPushNotification(
	subscription: { endpoint: string; p256dh: string; auth: string },
	payload: object,
	vapidKeys: { publicKey: string; privateKey: string; subject: string }
): Promise<boolean> {
	try {
		const payloadString = JSON.stringify(payload);
		const encrypted = await encryptPayload(payloadString, subscription.p256dh, subscription.auth);

		const vapidHeaders = await createVapidAuthHeader(
			subscription.endpoint,
			vapidKeys.subject,
			vapidKeys.publicKey,
			vapidKeys.privateKey
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
			// Subscription expired or invalid
			return false;
		}

		return response.ok;
	} catch (error) {
		console.error('Error sending push notification:', error);
		return false;
	}
}

/**
 * Handle scheduled cron trigger for daily push notifications
 */
export async function handleScheduled(
	event: ScheduledEvent,
	env: Env
): Promise<void> {
	console.log('Cron triggered at:', new Date(event.scheduledTime).toISOString());

	const db = env.DB;
	if (!db) {
		console.error('Database not available');
		return;
	}

	// Get today's mission
	const mission = getTodaysMission();
	const payload = {
		title: "Today's Kindness Mission",
		body: mission,
		icon: '/icons/icon-192.svg',
		badge: '/icons/icon-192.svg',
		tag: 'kindness-mission',
		data: { url: '/' }
	};

	// Get all active subscriptions
	const { results } = await db
		.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE active = 1')
		.all<{ endpoint: string; p256dh: string; auth: string }>();

	if (!results || results.length === 0) {
		console.log('No active subscriptions found');
		return;
	}

	console.log(`Sending notifications to ${results.length} subscribers`);

	const vapidKeys = {
		publicKey: env.VAPID_PUBLIC_KEY,
		privateKey: env.VAPID_PRIVATE_KEY,
		subject: env.VAPID_SUBJECT || 'mailto:hello@kindspread.app'
	};

	// Send notifications in batches
	const expiredEndpoints: string[] = [];

	await Promise.all(
		results.map(async (subscription) => {
			const success = await sendPushNotification(subscription, payload, vapidKeys);
			if (!success) {
				expiredEndpoints.push(subscription.endpoint);
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
