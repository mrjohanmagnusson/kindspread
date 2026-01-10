import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { createVapidAuthHeader, encryptPayload } from '$lib/server/web-push';

// Test endpoint - only available in development
export async function POST({ platform, url }: RequestEvent) {
	const isDev = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

	if (!isDev) {
		return json({ error: 'Test endpoint only available in development' }, { status: 403 });
	}

	const db = platform?.env?.DB;
	if (!db) {
		return json({ error: 'Database not configured' }, { status: 500 });
	}

	const vapidPublicKey = platform?.env?.VAPID_PUBLIC_KEY;
	const vapidPrivateKey = platform?.env?.VAPID_PRIVATE_KEY;
	const vapidSubject = platform?.env?.VAPID_SUBJECT || 'mailto:test@localhost';

	if (!vapidPublicKey || !vapidPrivateKey) {
		return json({ error: 'VAPID keys not configured' }, { status: 500 });
	}

	// Get all active subscriptions
	const { results } = await db
		.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE active = 1')
		.all<{ endpoint: string; p256dh: string; auth: string }>();

	if (!results || results.length === 0) {
		return json(
			{ error: 'No active subscriptions found. Enable notifications first!' },
			{ status: 404 }
		);
	}

	const payload = JSON.stringify({
		title: '🧪 Test Notification',
		body: 'This is a test push notification from KindSpread!',
		icon: '/icons/icon-192.svg',
		badge: '/icons/icon-192.svg',
		tag: 'test-notification',
		data: { url: '/' }
	});

	const results_status: { endpoint: string; success: boolean; status?: number; error?: string }[] = [];

	for (const subscription of results) {
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
					TTL: '60'
				},
				body: encrypted as unknown as BodyInit
			});

			const responseText = await response.text();

			results_status.push({
				endpoint: subscription.endpoint.slice(0, 50) + '...',
				success: response.ok,
				status: response.status,
				error: response.ok ? undefined : responseText
			});

			// If subscription is expired/invalid, mark as inactive
			if (response.status === 410 || response.status === 404) {
				await db
					.prepare('UPDATE push_subscriptions SET active = 0 WHERE endpoint = ?')
					.bind(subscription.endpoint)
					.run();
			}
		} catch (error) {
			results_status.push({
				endpoint: subscription.endpoint.slice(0, 50) + '...',
				success: false,
				error: String(error)
			});
		}
	}

	return json({
		message: `Sent test notification to ${results.length} subscriber(s)`,
		results: results_status
	});
}
