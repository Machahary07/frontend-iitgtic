import { createHmac, timingSafeEqual } from 'node:crypto';
import { ADMIN_SESSION_SECRET } from '$env/static/private';

// Email-confirmation links for founders.
//
// The link is clicked from an inbox with no session to lean on — possibly in a
// different browser to the one that signed up — so, like the newsletter
// unsubscribe link, the signature is the whole guard: the user id and an expiry
// are HMAC'd with the server secret, and the /verify-email route trusts a link
// only if it re-signs to the same value and has not expired. Reusing
// ADMIN_SESSION_SECRET keeps this to one secret; the label namespaces it so a
// verify token can never be mistaken for a session or an unsubscribe one.

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function sign(userId: string, expires: number): string {
	return createHmac('sha256', ADMIN_SESSION_SECRET)
		.update(`email-verify:${userId}:${expires}`)
		.digest('hex');
}

export function verifyEmailUrl(origin: string, userId: string): string {
	const base = origin.replace(/\/+$/, '');
	const expires = Date.now() + TTL_MS;
	const params = new URLSearchParams({ u: userId, e: String(expires), t: sign(userId, expires) });
	return `${base}/verify-email?${params.toString()}`;
}

export function checkEmailToken(userId: string, expires: string, token: string): boolean {
	if (!userId || !expires || !token) return false;

	const exp = Number(expires);
	if (!Number.isFinite(exp) || Date.now() > exp) return false;

	const expected = sign(userId, exp);
	// timingSafeEqual throws on a length mismatch, so guard it first.
	if (token.length !== expected.length) return false;
	try {
		return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
	} catch {
		return false;
	}
}
