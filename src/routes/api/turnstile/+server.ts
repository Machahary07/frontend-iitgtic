import { json } from '@sveltejs/kit';
import { verifyTurnstile } from '$lib/server/turnstile';
import { withinLimit } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	// This route spends a Cloudflare siteverify call per request, so it is worth
	// a limit of its own even though it writes nothing.
	if (!(await withinLimit('turnstile', getClientAddress()))) {
		return json({ success: false }, { status: 429 });
	}

	const { token } = (await request.json().catch(() => ({}))) as { token?: string };
	if (!token) return json({ success: false }, { status: 400 });

	return json({ success: await verifyTurnstile(token, getClientAddress()) });
};
