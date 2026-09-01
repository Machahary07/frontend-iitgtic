// Company accounts for the job-posting portal, backed by Supabase Auth.
//
// A company signs up as a normal auth user carrying `role: 'company'` in its
// metadata; the on_auth_user_created trigger then writes the matching row into
// public.companies with status 'pending'. companies.id IS the auth user id, so
// a company's id and its session user id are interchangeable.
//
// `status` is not writable by the authenticated role — only the TIC admin
// routes (service role) can verify or reject an account.

import { supabase } from '$lib/supabaseClient';
import { AFTER_COMPANY_SIGNUP, authCallbackUrl } from '$lib/utils/authRedirect';

export type CompanyStatus = 'pending' | 'verified' | 'rejected';

export type CompanyAccount = {
	id: string;
	email: string;
	companyName: string;
	companySlug: string;
	website: string;
	contactName: string;
	createdAt: string;
	status: CompanyStatus;
	rejectionReason?: string;
};

type CompanyRow = {
	id: string;
	email: string;
	company_name: string;
	company_slug: string;
	website: string;
	contact_name: string;
	status: CompanyStatus;
	rejection_reason: string | null;
	created_at: string;
};

const COLUMNS =
	'id, email, company_name, company_slug, website, contact_name, status, rejection_reason, created_at';

function toAccount(row: CompanyRow): CompanyAccount {
	return {
		id: row.id,
		email: row.email,
		companyName: row.company_name,
		companySlug: row.company_slug,
		website: row.website,
		contactName: row.contact_name,
		status: row.status,
		rejectionReason: row.rejection_reason ?? undefined,
		createdAt: row.created_at
	};
}

export function slugify(value: string): string {
	return (
		value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 64) || 'company'
	);
}

// Fired after a successful signup. The server checks the address really does
// belong to a just-created account before it sends anything, so a failure here
// is not worth surfacing — the account exists either way.
export async function sendCompanySignupEmail(email: string): Promise<void> {
	await fetch('/api/company-account', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email })
	}).catch(() => undefined);
}

export type SignupResult =
	| { ok: true; account: CompanyAccount | null; needsEmailConfirmation: boolean; email: string }
	| { ok: false; error: string };

export async function signupCompany(input: {
	email: string;
	password: string;
	companyName: string;
	website?: string;
	contactName?: string;
}): Promise<SignupResult> {
	const email = input.email.trim().toLowerCase();
	const companyName = input.companyName.trim();

	if (!email || !input.password || !companyName) {
		return { ok: false, error: 'Email, password and company name are all required.' };
	}
	if (input.password.length < 6) {
		return { ok: false, error: 'Password must be at least 6 characters.' };
	}

	const { data, error } = await supabase.auth.signUp({
		email,
		password: input.password,
		options: {
			// Without this the confirmation link falls back to the project's Site URL.
			emailRedirectTo: authCallbackUrl(AFTER_COMPANY_SIGNUP),
			data: {
				role: 'company',
				company_name: companyName,
				website: input.website?.trim() ?? '',
				contact_name: input.contactName?.trim() ?? '',
				full_name: input.contactName?.trim() ?? ''
			}
		}
	});

	if (error) {
		return { ok: false, error: friendlyAuthError(error.message) };
	}
	// Supabase returns a user with an empty identities array when the address is
	// already registered, rather than leaking that fact through an error.
	if (data.user && data.user.identities && data.user.identities.length === 0) {
		return { ok: false, error: 'An account with this email already exists.' };
	}

	// No session means the project still requires email confirmation.
	if (!data.session) {
		return { ok: true, account: null, needsEmailConfirmation: true, email };
	}

	return {
		ok: true,
		account: await getCurrentCompany(),
		needsEmailConfirmation: false,
		email
	};
}

export async function loginCompany(
	email: string,
	password: string
): Promise<{ ok: true; account: CompanyAccount } | { ok: false; error: string }> {
	const { error } = await supabase.auth.signInWithPassword({
		email: email.trim().toLowerCase(),
		password
	});
	if (error) {
		return { ok: false, error: friendlyAuthError(error.message) };
	}

	const account = await getCurrentCompany();
	if (!account) {
		await supabase.auth.signOut();
		return { ok: false, error: 'This login is not a company account.' };
	}
	return { ok: true, account };
}

export async function logoutCompany(): Promise<void> {
	await supabase.auth.signOut();
}

export async function getCurrentCompany(): Promise<CompanyAccount | null> {
	const { data: sessionData } = await supabase.auth.getSession();
	const userId = sessionData.session?.user.id;
	if (!userId) return null;

	const { data, error } = await supabase
		.from('companies')
		.select(COLUMNS)
		.eq('id', userId)
		.maybeSingle();

	if (error || !data) return null;
	return toAccount(data as CompanyRow);
}

export async function updateCurrentCompany(
	patch: Partial<Pick<CompanyAccount, 'companyName' | 'website' | 'contactName'>>
): Promise<CompanyAccount | null> {
	const { data: sessionData } = await supabase.auth.getSession();
	const userId = sessionData.session?.user.id;
	if (!userId) return null;

	const update: Record<string, string> = {};
	if (patch.companyName !== undefined) {
		update.company_name = patch.companyName.trim();
		update.company_slug = slugify(patch.companyName);
	}
	if (patch.website !== undefined) update.website = patch.website.trim();
	if (patch.contactName !== undefined) update.contact_name = patch.contactName.trim();

	const { data, error } = await supabase
		.from('companies')
		.update(update)
		.eq('id', userId)
		.select(COLUMNS)
		.maybeSingle();

	if (error || !data) return null;
	return toAccount(data as CompanyRow);
}

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

export async function deleteCurrentCompany(): Promise<boolean> {
	const { data: sessionData } = await supabase.auth.getSession();
	const token = sessionData.session?.access_token;
	if (!token) return false;

	const res = await fetch('/api/company-account', {
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
