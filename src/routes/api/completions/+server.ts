import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export interface MissionCompletion {
	id: number;
	mission_text: string;
	latitude: number;
	longitude: number;
	city: string | null;
	country: string | null;
	completed_at: string;
}

// GET - Fetch recent mission completions for the map
export async function GET({ platform, url }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) {
		return json({ error: 'Database not configured' }, { status: 500 });
	}

	// Optional query params for filtering
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
	const hours = parseInt(url.searchParams.get('hours') || '24'); // Last N hours

	try {
		const { results } = await db
			.prepare(
				`SELECT id, mission_text, latitude, longitude, city, country, completed_at 
				FROM mission_completions 
				WHERE completed_at >= datetime('now', '-' || ? || ' hours')
				ORDER BY completed_at DESC 
				LIMIT ?`
			)
			.bind(hours, limit)
			.all<MissionCompletion>();

		return json({
			completions: results || [],
			count: results?.length || 0
		});
	} catch (error) {
		console.error('Error fetching completions:', error);
		return json({ error: 'Failed to fetch completions' }, { status: 500 });
	}
}

// POST - Save a new mission completion
export async function POST({ request, platform }: RequestEvent) {
	const db = platform?.env?.DB;
	if (!db) {
		return json({ error: 'Database not configured' }, { status: 500 });
	}

	try {
		const body = (await request.json()) as {
			mission_text?: string;
			latitude?: number;
			longitude?: number;
			city?: string;
			country?: string;
			anonymous_id?: string;
		};

		// Validate required fields
		if (!body.mission_text || body.latitude === undefined || body.longitude === undefined) {
			return json(
				{ error: 'Missing required fields: mission_text, latitude, longitude' },
				{ status: 400 }
			);
		}

		// Validate coordinates
		if (
			body.latitude < -90 ||
			body.latitude > 90 ||
			body.longitude < -180 ||
			body.longitude > 180
		) {
			return json({ error: 'Invalid coordinates' }, { status: 400 });
		}

		// Optional: Check for duplicate completion from same user today
		if (body.anonymous_id) {
			const today = new Date().toISOString().split('T')[0];
			const existing = await db
				.prepare(
					`SELECT id FROM mission_completions 
					WHERE anonymous_id = ? AND date(completed_at) = ?`
				)
				.bind(body.anonymous_id, today)
				.first();

			if (existing) {
				return json(
					{ error: 'Already completed a mission today', duplicate: true },
					{ status: 409 }
				);
			}
		}

		// Insert the completion
		const result = await db
			.prepare(
				`INSERT INTO mission_completions (mission_text, latitude, longitude, city, country, anonymous_id)
				VALUES (?, ?, ?, ?, ?, ?)`
			)
			.bind(
				body.mission_text,
				body.latitude,
				body.longitude,
				body.city || null,
				body.country || null,
				body.anonymous_id || null
			)
			.run();

		return json({
			success: true,
			id: result.meta.last_row_id,
			message: 'Mission completion saved!'
		});
	} catch (error) {
		console.error('Error saving completion:', error);
		return json({ error: 'Failed to save completion' }, { status: 500 });
	}
}
