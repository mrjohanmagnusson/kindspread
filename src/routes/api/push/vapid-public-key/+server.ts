import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET({ platform }: RequestEvent) {
	const publicKey = platform?.env?.VAPID_PUBLIC_KEY;

	if (!publicKey) {
		return json({ error: 'VAPID public key not configured' }, { status: 500 });
	}

	return json({ publicKey });
}

