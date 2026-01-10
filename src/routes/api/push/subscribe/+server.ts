import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request, platform }: RequestEvent) {
	try {
		const subscription = (await request.json()) as {
			endpoint?: string;
			keys?: { p256dh?: string; auth?: string };
		};

		if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
			return json({ error: 'Invalid subscription object' }, { status: 400 });
		}

		const db = platform?.env?.DB;
		if (!db) {
			console.error('Database not available');
			return json({ error: 'Database not configured' }, { status: 500 });
		}

		// Upsert subscription (insert or update if exists)
		await db
			.prepare(
				`INSERT INTO push_subscriptions (endpoint, p256dh, auth, active)
				VALUES (?, ?, ?, 1)
				ON CONFLICT(endpoint) DO UPDATE SET
					p256dh = excluded.p256dh,
					auth = excluded.auth,
					active = 1`
			)
			.bind(subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth)
			.run();

		return json({ success: true, message: 'Subscription saved' });
	} catch (error) {
		console.error('Error saving subscription:', error);
		return json({ error: 'Failed to save subscription' }, { status: 500 });
	}
}

export async function DELETE({ request, platform }: RequestEvent) {
	try {
		const { endpoint } = (await request.json()) as { endpoint: string };

		if (!endpoint) {
			return json({ error: 'Endpoint required' }, { status: 400 });
		}

		const db = platform?.env?.DB;
		if (!db) {
			return json({ error: 'Database not configured' }, { status: 500 });
		}

		// Mark subscription as inactive instead of deleting
		await db
			.prepare('UPDATE push_subscriptions SET active = 0 WHERE endpoint = ?')
			.bind(endpoint)
			.run();

		return json({ success: true, message: 'Subscription removed' });
	} catch (error) {
		console.error('Error removing subscription:', error);
		return json({ error: 'Failed to remove subscription' }, { status: 500 });
	}
}
