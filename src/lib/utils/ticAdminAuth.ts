// TIC team admin auth — what is left of it.
//
// Signing in moved to the one door at /login (see $lib/utils/appAuth): admins are
// Supabase Auth users whose profile carries role 'admin', and /api/session-login
// is what verifies that server-side and issues the signed httpOnly cookie. That
// cookie — not a token in the browser — authorises the service-role admin routes
// and lets page views and audit entries name the person responsible.
//
// What stays here is the one thing the universal login cannot do: create the
// very first admin, on a console that has none.

import { signOut } from '$lib/utils/appAuth';

export type AdminIdentity = { userId: string; email: string; name: string };

// Only usable while the console has no admin at all.
export async function bootstrapFirstAdmin(input: {
	setupPassword: string;
	email: string;
	password: string;
	fullName: string;
	captchaToken: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	try {
		const res = await fetch('/api/tic-admin-login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				bootstrapPassword: input.setupPassword,
				email: input.email,
				password: input.password,
				fullName: input.fullName,
				captchaToken: input.captchaToken
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
	// Both consoles share one sign-out, so an admin who also runs a startup is
	// not left holding a live founder cookie.
	await signOut();
}
