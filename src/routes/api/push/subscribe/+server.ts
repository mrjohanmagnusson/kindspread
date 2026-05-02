import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request, platform }: RequestEvent) {
	try {
		const body = (await request.json()) as {
			endpoint?: string;
			keys?: { p256dh?: string; auth?: string };
			locale?: string;
		};

		if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
			return json({ error: 'Invalid subscription object' }, { status: 400 });
		}

		const db = platform?.env?.DB;
		if (!db) {
			console.error('Database not available');
			return json({ error: 'Database not configured' }, { status: 500 });
		}

		const locale = body.locale === 'sv' ? 'sv' : 'en';

		// Upsert subscription (insert or update if exists)
		await db
			.prepare(
				`INSERT INTO push_subscriptions (endpoint, p256dh, auth, locale, active)
				VALUES (?, ?, ?, ?, 1)
				ON CONFLICT(endpoint) DO UPDATE SET
					p256dh = excluded.p256dh,
					auth = excluded.auth,
					locale = excluded.locale,
					active = 1`
			)
			.bind(body.endpoint, body.keys.p256dh, body.keys.auth, locale)
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
