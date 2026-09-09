import { createHmac, timingSafeEqual } from 'node:crypto';
import { ADMIN_SESSION_SECRET } from '$env/static/private';

// Newsletter unsubscribe links.
//
// An unsubscribe link has to work with no account and no login, so the only
// thing standing between it and anyone removing anyone is the signature: the
// address is HMAC'd with the server secret, and a link is valid only for the
// address it was minted for. Reusing ADMIN_SESSION_SECRET keeps this to one
// secret to manage; the label namespaces it so an unsubscribe token can never
// be mistaken for a session one.

function sign(email: string): string {
	return createHmac('sha256', ADMIN_SESSION_SECRET)
		.update(`newsletter-unsubscribe:${email.trim().toLowerCase()}`)
		.digest('hex');
}

export function unsubscribeToken(email: string): string {
	return sign(email);
}

export function verifyUnsubscribe(email: string, token: string): boolean {
	if (!email || !token) return false;
	const expected = sign(email);
	// timingSafeEqual throws on a length mismatch, so guard it first.
	if (token.length !== expected.length) return false;
	try {
		return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
	} catch {
		return false;
	}
}

// The link to drop into a newsletter, so every send carries a working way out.
export function unsubscribeUrl(origin: string, email: string): string {
	const base = origin.replace(/\/+$/, '');
	const params = new URLSearchParams({ e: email, t: unsubscribeToken(email) });
	return `${base}/unsubscribe?${params.toString()}`;
}
