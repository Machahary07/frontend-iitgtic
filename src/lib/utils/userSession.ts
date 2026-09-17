// Founder accounts — the /apply sign-up — backed by Supabase Auth. Signing up
// creates an auth user with `role: 'founder'` metadata; the on_auth_user_created
// trigger writes the matching public.profiles row.
//
// Signing in is not here: everyone uses the one door at /login, through
// $lib/utils/appAuth.

import { supabase } from '$lib/supabaseClient';
import { signOut } from '$lib/utils/appAuth';
import {
	AFTER_FOUNDER_SIGNUP,
	AFTER_PASSWORD_RESET,
	authCallbackUrl
} from '$lib/utils/authRedirect';

export type UserSession = {
	id?: string;
	name?: string;
	email?: string;
	phone?: string;
	// Whether the address has been confirmed via the /verify-email link. Defaults
	// to true when it cannot be read, so the step-8 gate stays open until the
	// email_verified column actually exists — deploying the code ahead of the
	// migration must not block anyone from submitting.
	emailVerified?: boolean;
};

export type AuthResult =
	| { ok: true; needsEmailConfirmation: boolean; session: UserSession }
	| { ok: false; error: string };

export async function signUpFounder(input: {
	name: string;
	email: string;
	phone: string;
	password: string;
}): Promise<AuthResult> {
	const email = input.email.trim().toLowerCase();
	const { data, error } = await supabase.auth.signUp({
		email,
		password: input.password,
		options: {
			// Without this the confirmation link falls back to the project's Site URL.
			emailRedirectTo: authCallbackUrl(AFTER_FOUNDER_SIGNUP),
			data: {
				role: 'founder',
				full_name: input.name.trim(),
				phone: input.phone.trim()
			}
		}
	});

	if (error) return { ok: false, error: friendlyAuthError(error.message) };
	if (data.user && data.user.identities && data.user.identities.length === 0) {
		return { ok: false, error: 'An account with this email already exists.' };
	}

	return {
		ok: true,
		needsEmailConfirmation: !data.session,
		session: {
			id: data.user?.id,
			name: input.name.trim(),
			email,
			phone: input.phone.trim()
		}
	};
}

export async function loadUserSession(): Promise<UserSession> {
	const { data: sessionData } = await supabase.auth.getSession();
	const user = sessionData.session?.user;
	if (!user) return {};

	const { data } = await supabase
		.from('profiles')
		.select('full_name, email, phone')
		.eq('id', user.id)
		.maybeSingle();

	return {
		id: user.id,
		name: data?.full_name || (user.user_metadata?.full_name as string) || '',
		email: data?.email || user.email || '',
		phone: data?.phone || (user.user_metadata?.phone as string) || '',
		emailVerified: await readEmailVerified(user.id)
	};
}

// Read the verification flag on its own, so a pre-migration missing column (or
// any read error) defaults the step-8 gate to open rather than wiping the whole
// profile read above. Once the migration is live this returns the real value.
async function readEmailVerified(userId: string): Promise<boolean> {
	const { data, error } = await supabase
		.from('profiles')
		.select('email_verified')
		.eq('id', userId)
		.maybeSingle();
	if (error || !data) return true;
	return (data.email_verified as boolean | undefined) ?? true;
}

export async function saveUserSession(patch: Partial<UserSession>): Promise<void> {
	const { data: sessionData } = await supabase.auth.getSession();
	const userId = sessionData.session?.user.id;
	if (!userId) return;

	const update: Record<string, string> = {};
	if (patch.name !== undefined) update.full_name = patch.name.trim();
	if (patch.email !== undefined) update.email = patch.email.trim();
	if (patch.phone !== undefined) update.phone = patch.phone.trim();
	if (Object.keys(update).length === 0) return;

	await supabase.from('profiles').update(update).eq('id', userId);
}

export async function clearUserSession(): Promise<void> {
	await signOut();
}

/**
 * Asks the server to send the welcome / confirm-your-email message to the
 * signed-in founder. Best-effort: fired at signup and from the "resend" control
 * on the application, and never allowed to interrupt either flow.
 */
export async function sendFounderWelcome(): Promise<void> {
	try {
		const { data } = await supabase.auth.getSession();
		const token = data.session?.access_token;
		if (!token) return;
		await fetch('/api/founder-welcome', {
			method: 'POST',
			headers: { authorization: `Bearer ${token}` }
		});
	} catch {
		// A courtesy email that did not go out is not worth interrupting anyone over.
	}
}

/**
 * Asks the server to send the "welcome back" sign-in notice. Best-effort and
 * throttled server-side to once a day, so calling it on every login is fine.
 */
export async function sendFounderLoginNotice(): Promise<void> {
	try {
		const { data } = await supabase.auth.getSession();
		const token = data.session?.access_token;
		if (!token) return;
		await fetch('/api/founder-login', {
			method: 'POST',
			headers: { authorization: `Bearer ${token}` }
		});
	} catch {
		// A sign-in notice that did not send is not worth interrupting the login.
	}
}

/**
 * Emails a reset link. Used by both the founder and company sign-in screens.
 *
 * Always reports success. Answering differently for a registered and an unknown
 * address would turn the form into a way to test whether somebody has an
 * account here, which is the same reason the signup receipt is silent on a miss.
 */
export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
	const address = email.trim().toLowerCase();
	if (address) {
		await supabase.auth.resetPasswordForEmail(address, {
			redirectTo: authCallbackUrl(AFTER_PASSWORD_RESET)
		});
	}
	return { ok: true };
}

function friendlyAuthError(message: string): string {
	const m = message.toLowerCase();
	if (m.includes('invalid login credentials')) return 'Invalid email or password.';
	if (m.includes('already registered')) return 'An account with this email already exists.';
	if (m.includes('email not confirmed')) {
		return 'Please confirm your email address before signing in.';
	}
	return message;
}
