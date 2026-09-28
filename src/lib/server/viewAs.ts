import { createHmac, timingSafeEqual } from 'node:crypto';
import { dev } from '$app/environment';
import { ADMIN_SESSION_SECRET } from '$env/static/private';
import type { Cookies } from '@sveltejs/kit';

// "View as": a developer opening the console as another account, to see exactly
// what that person sees — a CEO's narrower sidebar, a founder's own console.
//
// It never changes who is signed in. The developer keeps their own session
// cookie; this second cookie only names who to show them as, and it counts for
// nothing unless the session beside it belongs to the developer who set it and
// that account still holds a role allowed to view as. So a stolen or copied
// view-as cookie on anyone else's browser is inert.
//
// Four hours, then it lapses on its own, so nobody is left acting as someone
// else because they forgot to exit.

const COOKIE = 'tic_view_as';
const MAX_AGE_SECONDS = 60 * 60 * 4;

export type ViewAs = {
	/** The account being viewed as. */
	targetUserId: string;
	/** The developer who started it. */
	by: string;
};

function sign(payload: string): string {
	return createHmac('sha256', `view-as:${ADMIN_SESSION_SECRET}`).update(payload).digest('hex');
}

export function startViewAs(cookies: Cookies, value: ViewAs): void {
	const payload = Buffer.from(
		JSON.stringify({ ...value, exp: Date.now() + MAX_AGE_SECONDS * 1000 }),
		'utf8'
	).toString('base64url');
	cookies.set(COOKIE, `${payload}.${sign(payload)}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: MAX_AGE_SECONDS
	});
}

export function stopViewAs(cookies: Cookies): void {
	cookies.delete(COOKIE, { path: '/' });
}

// Null for anything missing, forged or expired. Never throws.
export function readViewAs(cookies: Cookies): ViewAs | null {
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
		const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as ViewAs & {
			exp: number;
		};
		if (!parsed.exp || parsed.exp < Date.now()) return null;
		if (!parsed.targetUserId || !parsed.by) return null;
		return { targetUserId: parsed.targetUserId, by: parsed.by };
	} catch {
		return null;
	}
}
