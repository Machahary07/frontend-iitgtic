// TIC team admin auth.
//
// Admins are Supabase Auth users whose profile carries role 'admin'. Signing in
// happens in two steps: supabase-js authenticates the credentials, then the
// resulting access token is handed to /api/tic-admin-login, which verifies the
// role server-side and issues a signed httpOnly session cookie. That cookie —
// not a token in the browser — is what authorises the service-role admin routes,
// and it is what lets page views and audit entries name the person responsible.

import { supabase } from '$lib/supabaseClient';

export type AdminIdentity = { userId: string; email: string; name: string };

export async function loginTicAdmin(
	email: string,
	password: string
): Promise<{ ok: true; admin: AdminIdentity } | { ok: false; error: string }> {
	const { data, error } = await supabase.auth.signInWithPassword({
		email: email.trim().toLowerCase(),
		password
	});
	if (error) {
		const message = error.message.toLowerCase();
		if (message.includes('invalid login credentials')) {
			return { ok: false, error: 'Invalid email or password.' };
		}
		return { ok: false, error: error.message };
	}

	const token = data.session?.access_token;
	if (!token) return { ok: false, error: 'Could not start a session.' };

	let body: { ok?: boolean; admin?: AdminIdentity; error?: string };
	try {
		const res = await fetch('/api/tic-admin-login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ accessToken: token })
		});
		body = (await res.json()) as typeof body;
	} catch {
		return { ok: false, error: 'Could not reach the server. Please try again.' };
	}

	if (!body.ok || !body.admin) {
		// The credentials were valid but this account is not an admin — do not
		// leave a half-signed-in Supabase session behind.
		await supabase.auth.signOut();
		return { ok: false, error: body.error ?? 'This account does not have admin access.' };
	}

	return { ok: true, admin: body.admin };
}

// Only usable while the console has no admin at all.
export async function bootstrapFirstAdmin(input: {
	setupPassword: string;
	email: string;
	password: string;
	fullName: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	try {
		const res = await fetch('/api/tic-admin-login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				bootstrapPassword: input.setupPassword,
				email: input.email,
				password: input.password,
				fullName: input.fullName
			})
		});
		const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
		if (!res.ok || !body.ok) {
			return { ok: false, error: body.message ?? 'Could not create the account.' };
		}
		return { ok: true };
	} catch {
		return { ok: false, error: 'Could not reach the server. Please try again.' };
	}
}

export async function logoutTicAdmin(): Promise<void> {
	try {
		await fetch('/api/tic-admin-login', { method: 'DELETE' });
	} catch {
		// Best-effort; the cookie expires on its own.
	}
	await supabase.auth.signOut();
}
