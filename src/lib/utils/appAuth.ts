// One sign-in for the whole site.
//
// Everyone — the TIC team, a founder, someone a founder added to their company —
// signs in at /login with the same form. supabase-js checks the credentials,
// /api/session-login checks who the account is and issues the matching signed
// cookie, and the server is what decides which console the browser is sent to.
//
// Nothing here reads a role from the client. The redirect comes back from the
// server, so a tampered response can only send someone to a console whose own
// layout guard will turn them away.

import { supabase } from '$lib/supabaseClient';
import { clearAdminSeenFlags } from '$lib/utils/adminSeen';

export type SignedInAs = 'admin' | 'founder';

export type SignInResult =
	| { ok: true; role: SignedInAs; redirect: string; name: string; email: string }
	| { ok: false; error: string };

export async function signIn(
	email: string,
	password: string,
	captchaToken: string
): Promise<SignInResult> {
	const { data, error } = await supabase.auth.signInWithPassword({
		email: email.trim().toLowerCase(),
		password
	});
	if (error) return { ok: false, error: friendlyAuthError(error.message) };

	const token = data.session?.access_token;
	if (!token) return { ok: false, error: 'Could not start a session.' };

	let body: {
		ok?: boolean;
		role?: SignedInAs;
		redirect?: string;
		name?: string;
		email?: string;
		error?: string;
		message?: string;
	};
	try {
		const res = await fetch('/api/session-login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ accessToken: token, captchaToken })
		});
		body = (await res.json().catch(() => ({}))) as typeof body;
	} catch {
		await supabase.auth.signOut();
		return { ok: false, error: 'Could not reach the server. Please try again.' };
	}

	if (!body.ok || !body.role || !body.redirect) {
		// The credentials were fine but the server would not seat us anywhere —
		// do not leave a half-signed-in Supabase session behind.
		await supabase.auth.signOut();
		return { ok: false, error: body.error ?? body.message ?? 'Could not sign in.' };
	}

	return {
		ok: true,
		role: body.role,
		redirect: body.redirect,
		name: body.name ?? '',
		email: body.email ?? ''
	};
}

export async function signOut(): Promise<void> {
	// The one-time console notices are scoped to a login, so whoever signs in next
	// sees them once again.
	clearAdminSeenFlags();
	try {
		await fetch('/api/session-login', { method: 'DELETE' });
	} catch {
		// Best-effort; both cookies expire on their own.
	}
	await supabase.auth.signOut();
}

function friendlyAuthError(message: string): string {
	const m = message.toLowerCase();
	if (m.includes('invalid login credentials')) return 'Invalid email or password.';
	if (m.includes('email not confirmed')) {
		return 'Please confirm your email address before signing in.';
	}
	return message;
}
