import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import type { RequestHandler } from './$types';
import { clearTicAdminSession } from '$lib/server/ticAdminSession';
import { clearFounderSession } from '$lib/server/founderSession';
import { sendTemplateEmail } from '$lib/server/email';
import { FULL_ADMIN_ROLES, type StaffRole } from '$lib/utils/roles';

// Closing your own account. Deleting the auth user is the only part that needs
// the service role — a login that survives the account would be worse than
// leaving both in place.
//
// The companies the person created go with it: companies.owner_id cascades on
// delete, and jobs cascade from there. Applicants and any incubation application
// keep their rows and lose the link, so TIC's record of what it reviewed does
// not disappear with the account.

export const DELETE: RequestHandler = async ({ request, cookies }) => {
	const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
	if (!token) error(401, 'Missing access token.');

	const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
	if (authError || !data.user) error(401, 'Invalid session.');
	const user = data.user;

	// Read before the cascade takes them: this is what the Users page shows in
	// place of the account once it is gone.
	const [{ data: profile }, { data: companies }] = await Promise.all([
		supabaseAdmin.from('profiles').select('full_name, email, role').eq('id', user.id).maybeSingle(),
		supabaseAdmin.from('companies').select('company_name').eq('owner_id', user.id)
	]);

	// The same rule the Users page applies: the console is never left with no
	// one who can run it.
	if (FULL_ADMIN_ROLES.includes(profile?.role as StaffRole)) {
		const { count } = await supabaseAdmin
			.from('profiles')
			.select('id', { count: 'exact', head: true })
			.in('role', FULL_ADMIN_ROLES);
		if ((count ?? 0) <= 1) error(400, 'This is the last admin account, so it cannot be deleted.');
	}

	const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
	if (deleteError) error(500, deleteError.message);
	clearTicAdminSession(cookies);
	clearFounderSession(cookies);

	const email = (profile?.email as string) || user.email || '';
	const fullName = (profile?.full_name as string) ?? '';

	const { error: logError } = await supabaseAdmin.from('deleted_accounts').insert({
		user_id: user.id,
		email,
		full_name: fullName,
		role: (profile?.role as string) ?? 'founder',
		companies: (companies ?? []).map((c) => c.company_name as string),
		joined_at: user.created_at
	});
	if (logError) console.error('[account] could not record the deletion:', logError.message);

	// Confirms the deletion, and is the alarm if someone else did it. Never fails
	// the request: the account is already gone.
	if (email) {
		await sendTemplateEmail({
			templateKey: 'account-self-deleted',
			to: email,
			toName: fullName,
			variables: { fullName: fullName.split(' ')[0] ?? '', email },
			context: { table: 'deleted_accounts', recordId: user.id }
		});
	}

	return json({ ok: true });
};
