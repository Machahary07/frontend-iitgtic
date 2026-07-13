import { json } from '@sveltejs/kit';
import { TURNSTILE_SECRET_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { token } = (await request.json().catch(() => ({}))) as { token?: string };
	if (!token) return json({ success: false }, { status: 400 });

	const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		body: new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token })
	});
	const data = (await res.json()) as { success?: boolean };
	return json({ success: data.success === true });
};
