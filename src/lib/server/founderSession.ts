import { createHmac, timingSafeEqual } from 'node:crypto';
import { dev } from '$app/environment';
import { ADMIN_SESSION_SECRET } from '$env/static/private';
import type { Cookies } from '@sveltejs/kit';

// The founder console's half of the session story. It works exactly like the TIC
// admin cookie — sign in with supabase-js, hand the access token to
// /api/session-login, and the server issues a signed httpOnly cookie once it has
// checked who you are — so /founder can be server-rendered and guarded in a
// layout rather than gated by an onMount in every page.
//
// Two cookies rather than one with a role field: a person can legitimately hold
// both (a TIC admin who also runs an incubated startup), and mixing them would
// mean signing out of one console to use the other.
//
// The signed cookie carries identity ONLY. Which company a founder is working on
// is a separate, unsigned cookie, because a founder may have several and the
// answer changes as they switch — and because every request re-checks that
// choice against the companies they actually hold. Nothing here is trusted as an
// authorisation claim on its own.

const COOKIE = 'tic_founder_session';
const COMPANY_COOKIE = 'tic_founder_company';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type FounderSession = {
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

export function issueFounderSession(cookies: Cookies, session: FounderSession): void {
	const payload = encode(JSON.stringify({ ...session, exp: Date.now() + MAX_AGE_SECONDS * 1000 }));
	cookies.set(COOKIE, `${payload}.${sign(payload)}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: MAX_AGE_SECONDS
	});
}

export function clearFounderSession(cookies: Cookies): void {
	cookies.delete(COOKIE, { path: '/' });
	cookies.delete(COMPANY_COOKIE, { path: '/' });
}

// Returns the signed-in founder, or null. Never throws on malformed input.
export function readFounderSession(cookies: Cookies): FounderSession | null {
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
		const parsed = JSON.parse(decode(payload)) as FounderSession & { exp: number };
		if (!parsed.exp || parsed.exp < Date.now()) return null;
		if (!parsed.userId) return null;
		return { userId: parsed.userId, email: parsed.email, name: parsed.name };
	} catch {
		return null;
	}
}

// Which company the console is currently pointed at. A preference, not a
// permission: every read of it is checked against the caller's own companies
// before it is used, so a hand-edited value selects nothing.
export function readActiveCompany(cookies: Cookies): string | null {
	return cookies.get(COMPANY_COOKIE) ?? null;
}

export function setActiveCompany(cookies: Cookies, companyId: string): void {
	cookies.set(COMPANY_COOKIE, companyId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: MAX_AGE_SECONDS
	});
}
