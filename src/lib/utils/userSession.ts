// Founder accounts — the /apply sign-up and /login pages — backed by Supabase
// Auth. Signing up creates an auth user with `role: 'founder'` metadata; the
// on_auth_user_created trigger writes the matching public.profiles row.

import { supabase } from '$lib/supabaseClient';

export type UserSession = {
	id?: string;
	name?: string;
	email?: string;
	phone?: string;
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

export async function signInFounder(email: string, password: string): Promise<AuthResult> {
	const { error } = await supabase.auth.signInWithPassword({
		email: email.trim().toLowerCase(),
		password
	});
	if (error) return { ok: false, error: friendlyAuthError(error.message) };

	return { ok: true, needsEmailConfirmation: false, session: await loadUserSession() };
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
		phone: data?.phone || (user.user_metadata?.phone as string) || ''
	};
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
	await supabase.auth.signOut();
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
