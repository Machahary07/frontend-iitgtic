import { TURNSTILE_SECRET_KEY } from '$env/static/private';

// Server-side Turnstile check. /api/turnstile exposes it to the widgets that
// verify a token on their own, and the submit routes call it directly — a form
// that only asks the browser to verify can be posted straight to the endpoint
// with the check skipped, so anything that writes to the database re-runs it
// here with the token it was given.

export async function verifyTurnstile(token: string | null | undefined, ip?: string | null) {
	if (!token) return false;

	const body = new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token });
	if (ip) body.set('remoteip', ip);

	try {
		const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			body
		});
		if (!res.ok) return false;
		const data = (await res.json()) as { success?: boolean };
		return data.success === true;
	} catch {
		return false;
	}
}
