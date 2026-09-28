import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { currentAccount, validatedAdminSession } from '$lib/server/sessionValidation';
import { startViewAs, stopViewAs } from '$lib/server/viewAs';
import { ACCOUNT_ROLES, isStaffRole, ROLE_INFO, roleLabel } from '$lib/utils/roles';
import type { Cookies } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// View as, for developers. See $lib/server/viewAs for how the cookie is kept
// honest.
//
// GET    ?q=&role=   accounts to pick from
// POST   { userId }  start viewing as that account, returns where to go
// DELETE             stop, returns where to go
//
// Entering and leaving is written to the audit trail, so a change made while
// viewing as someone can always be traced to the view that made it.

// Always the real person: while viewing as a CEO the session in hand is the
// CEO's, and the question is whether the developer behind it may do this.
async function requireDeveloper(cookies: Cookies) {
	const session = await validatedAdminSession(cookies);
	if (!session) error(401, 'Not signed in as a TIC admin.');
	const real = session.actor ?? session;
	if (!ROLE_INFO[real.role].viewAs) error(403, 'Only a developer can view as another account.');
	return { session, real };
}

export const GET: RequestHandler = async ({ cookies, url }) => {
	const { real, session } = await requireDeveloper(cookies);

	let query = supabaseAdmin
		.from('profiles')
		.select('id, role, full_name, email')
		.neq('id', real.userId)
		.order('full_name', { ascending: true })
		.limit(40);

	const role = url.searchParams.get('role');
	if (role && (ACCOUNT_ROLES as string[]).includes(role)) query = query.eq('role', role);

	// Only what a name or an address could contain, so the term cannot break out
	// of the filter expression it is spliced into.
	const term = (url.searchParams.get('q') ?? '').replace(/[^\p{L}\p{N}@._\- ]/gu, '').trim();
	if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);

	const { data, error: queryError } = await query;
	if (queryError) error(500, queryError.message);

	return json({
		viewing: session.viewing?.userId ?? null,
		accounts: (data ?? []).map((row) => ({
			id: row.id as string,
			name: (row.full_name as string) || '',
			email: (row.email as string) || '',
			role: row.role as string,
			roleLabel: roleLabel(row.role as string)
		}))
	});
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	const { real } = await requireDeveloper(cookies);
	const body = (await request.json().catch(() => ({}))) as { userId?: string };
	if (!body.userId) error(400, 'Missing account.');
	if (body.userId === real.userId) error(400, 'That is you.');

	const target = await currentAccount(body.userId);
	if (!target) error(404, 'That account is unavailable — deleted or suspended.');

	startViewAs(cookies, { targetUserId: target.userId, by: real.userId });

	await supabaseAdmin.from('audit_log').insert({
		source: 'app',
		actor_id: real.userId,
		actor_label: `${real.name || real.email} (${roleLabel(real.role)})`,
		action: `started viewing as ${target.name || target.email} (${roleLabel(target.role)})`,
		table_name: 'profiles',
		record_id: target.userId
	});

	// Staff are shown this console as they see it; a founder has their own.
	return json({ ok: true, redirect: isStaffRole(target.role) ? '/tic-admin' : '/founder' });
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	const { real, session } = await requireDeveloper(cookies);
	stopViewAs(cookies);

	if (session.viewing) {
		await supabaseAdmin.from('audit_log').insert({
			source: 'app',
			actor_id: real.userId,
			actor_label: `${real.name || real.email} (${roleLabel(real.role)})`,
			action: `stopped viewing as ${session.viewing.name || session.viewing.email}`,
			table_name: 'profiles',
			record_id: session.viewing.userId
		});
	}

	return json({ ok: true, redirect: '/tic-admin/roles' });
};
