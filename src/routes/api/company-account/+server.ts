import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { sendTemplateEmail } from '$lib/server/email';
import { LIMITS, retryMinutes, withinLimit } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';

// A company can delete its own account. Removing the row from `companies` is
// something RLS already allows, but the underlying auth user can only be deleted
// with the service role — otherwise the login would survive the account.

// Signup receipt. The browser creates the account itself with supabase-js, and
// when the project requires email confirmation there is no session to
// authenticate this call with — so the guard is the account rather than a token:
// the address must belong to a companies row that the signup trigger wrote in
// the last few minutes, and one that has not already been sent a receipt. An
// address a caller made up matches nothing, which is what keeps this from being
// an open relay.
const SIGNUP_WINDOW_MS = 10 * 60 * 1000;

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!(await withinLimit('signupReceipt', getClientAddress()))) {
		error(429, `Too many requests. Try again in ${retryMinutes(LIMITS.signupReceipt)} minutes.`);
	}

	const body = (await request.json().catch(() => ({}))) as { email?: string };
	const email = body.email?.trim().toLowerCase();
	if (!email) error(400, 'Missing email address.');

	// eq, not ilike: PostgREST hands an ilike value through as a LIKE pattern, so
	// `%` and `_` in the body would match somebody else's account and post them a
	// receipt. Supabase Auth stores addresses lowercased and the signup trigger
	// copies that value, so an exact match on the lowercased input is right.
	const { data: company } = await supabaseAdmin
		.from('companies')
		.select('id, email, company_name, contact_name, created_at')
		.eq('email', email)
		.maybeSingle();

	// Silent on a miss: answering differently for a real and an invented address
	// would turn this into a way to test whether a company has an account.
	if (!company) return json({ ok: true });
	if (Date.now() - new Date(company.created_at as string).getTime() > SIGNUP_WINDOW_MS) {
		return json({ ok: true });
	}

	const { count } = await supabaseAdmin
		.from('email_log')
		.select('id', { count: 'exact', head: true })
		.eq('template_key', 'company-signup')
		.eq('to_email', company.email as string);
	if ((count ?? 0) > 0) return json({ ok: true });

	await sendTemplateEmail({
		templateKey: 'company-signup',
		to: company.email as string,
		toName: (company.contact_name as string) || (company.company_name as string),
		variables: {
			companyName: (company.company_name as string) ?? '',
			contactName: (company.contact_name as string) ?? '',
			email: company.email as string
		},
		context: { table: 'companies', recordId: company.id }
	});

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request }) => {
	const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
	if (!token) error(401, 'Missing access token.');

	const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
	if (authError || !data.user) error(401, 'Invalid session.');

	const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(data.user.id);
	if (deleteError) error(500, deleteError.message);

	return json({ ok: true });
};
