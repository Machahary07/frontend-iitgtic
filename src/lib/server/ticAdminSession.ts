import { createHmac, timingSafeEqual } from 'node:crypto';
import { dev } from '$app/environment';
import { ADMIN_SESSION_SECRET } from '$env/static/private';
import type { Cookies } from '@sveltejs/kit';

// Admins are ordinary Supabase Auth users carrying role 'admin'. They sign in
// with supabase-js in the browser, hand the resulting access token to
// /api/tic-admin-login, and the server — having verified both the token and the
// role — issues this signed httpOnly cookie.
//
// Keeping the identity in a server-signed cookie rather than a bearer token means
// the request hooks can attribute page views and audit entries to a real person
// without the browser being able to claim to be someone else.

const COOKIE = 'tic_admin_session';
// Thirty days, and the admin layout renews it on every visit (a sliding window),
// so an admin is never signed out on their own while they are using the console —
// only an explicit logout, or ~30 days of no visits, ends the session.
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type AdminSession = {
	userId: string;
	email: string;
	name: string;
};

function sign(payload: string): string {
	return createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('hex');
}

function encode(value: string): string {
	return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string {
	return Buffer.from(value, 'base64url').toString('utf8');
}

export function issueTicAdminSession(cookies: Cookies, session: AdminSession): void {
	const payload = encode(JSON.stringify({ ...session, exp: Date.now() + MAX_AGE_SECONDS * 1000 }));
	cookies.set(COOKIE, `${payload}.${sign(payload)}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: MAX_AGE_SECONDS
	});
}

export function clearTicAdminSession(cookies: Cookies): void {
	cookies.delete(COOKIE, { path: '/' });
}

// Returns the signed-in admin, or null. Never throws on malformed input.
export function readTicAdminSession(cookies: Cookies): AdminSession | null {
	const raw = cookies.get(COOKIE);
	if (!raw) return null;

	const separator = raw.lastIndexOf('.');
	if (separator < 0) return null;

	const payload = raw.slice(0, separator);
	const provided = raw.slice(separator + 1);
	const expected = sign(payload);

	if (provided.length !== expected.length) return null;
	if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return null;

	try {
		const parsed = JSON.parse(decode(payload)) as AdminSession & { exp: number };
		if (!parsed.exp || parsed.exp < Date.now()) return null;
		if (!parsed.userId) return null;
		return { userId: parsed.userId, email: parsed.email, name: parsed.name };
	} catch {
		return null;
	}
}

export function isTicAdminRequest(cookies: Cookies): boolean {
	return readTicAdminSession(cookies) !== null;
}
