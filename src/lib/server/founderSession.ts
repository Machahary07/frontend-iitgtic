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

const COOKIE = 'tic_founder_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type FounderSession = {
	userId: string;
	email: string;
	name: string;
	/** The company this person works under. Null until TIC attaches them to one. */
	companyId: string | null;
	/** 'owner' signed the company up; 'member' was added by an owner. */
	memberRole: 'owner' | 'member';
	memberStatus: 'pending' | 'approved' | 'rejected';
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
		return {
			userId: parsed.userId,
			email: parsed.email,
			name: parsed.name,
			companyId: parsed.companyId ?? null,
			memberRole: parsed.memberRole === 'member' ? 'member' : 'owner',
			memberStatus: parsed.memberStatus ?? 'approved'
		};
	} catch {
		return null;
	}
}
