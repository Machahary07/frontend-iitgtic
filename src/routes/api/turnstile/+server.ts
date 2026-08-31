import { json } from '@sveltejs/kit';
import { verifyTurnstile } from '$lib/server/turnstile';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const { token } = (await request.json().catch(() => ({}))) as { token?: string };
	if (!token) return json({ success: false }, { status: 400 });

	return json({ success: await verifyTurnstile(token, getClientAddress()) });
};
