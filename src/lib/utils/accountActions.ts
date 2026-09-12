// The two account chores a founder can do for themselves, without waiting on
// anybody. Registering a startup is not one of them — that lives in the console,
// at /api/founder/companies — and signing in is /login for everyone, through
// $lib/utils/appAuth.

import { supabase } from '$lib/supabaseClient';

export async function changePassword(
	currentPassword: string,
	newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	if (newPassword.length < 6) {
		return { ok: false, error: 'New password must be at least 6 characters.' };
	}

	const { data: sessionData } = await supabase.auth.getSession();
	const email = sessionData.session?.user.email;
	if (!email) return { ok: false, error: 'Not logged in.' };

	// Supabase lets a signed-in user change their password without re-stating the
	// old one, so re-authenticate first to keep the "current password" check real.
	const { error: reauthError } = await supabase.auth.signInWithPassword({
		email,
		password: currentPassword
	});
	if (reauthError) {
		return { ok: false, error: 'Current password is incorrect.' };
	}

	const { error } = await supabase.auth.updateUser({ password: newPassword });
	if (error) return { ok: false, error: friendlyAuthError(error.message) };
	return { ok: true };
}

/** Closes the account itself, and every startup created under it. */
export async function deleteMyAccount(): Promise<boolean> {
	const { data: sessionData } = await supabase.auth.getSession();
	const token = sessionData.session?.access_token;
	if (!token) return false;

	const res = await fetch('/api/account', {
		method: 'DELETE',
		headers: { authorization: `Bearer ${token}` }
	});
	await supabase.auth.signOut();
	return res.ok;
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
