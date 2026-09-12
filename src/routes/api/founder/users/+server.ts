import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { logFounderAction, requireCompanyOwner } from '$lib/server/founderGuard';
import type { RequestHandler } from './$types';

// The people a founder adds to one of their startups.
//
// The account is created straight away and can sign in, but it lands on a
// waiting screen: profiles.member_status starts at 'pending' and only a TIC
// admin moves it to 'approved'. That is the whole point of the queue — a founder
// must not be able to hand out access to the console by themselves.
//
// POST   { companyId, fullName, email, password }  add a member, pending TIC
// DELETE ?companyId=&id=                           remove a member

export const POST: RequestHandler = async ({ cookies, request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		companyId?: string;
		fullName?: string;
		email?: string;
		password?: string;
	};
	const ctx = await requireCompanyOwner(cookies, body.companyId);

	const email = body.email?.trim().toLowerCase() ?? '';
	const fullName = body.fullName?.trim() ?? '';
	const password = body.password ?? '';

	if (!email || !fullName)
		return json({ ok: false, error: 'Name and email are required.' }, { status: 400 });
	if (password.length < 8) {
		return json({ ok: false, error: 'Set a password of at least 8 characters.' }, { status: 400 });
	}

	// company_id in the metadata is what the signup trigger reads to attach the
	// new profile to this company as a pending member.
	const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { full_name: fullName, company_id: ctx.companyId }
	});

	if (createError || !created.user) {
		const message = createError?.message ?? 'Could not create the account.';
		const taken = message.toLowerCase().includes('already');
		return json(
			{ ok: false, error: taken ? 'An account with this email already exists.' : message },
			{ status: 400 }
		);
	}

	// The trigger fires on a plain signup; creating a user through the admin API
	// takes the same path, but the columns are re-stated here so a member is
	// never left attached to nothing if that ever changes.
	const { error: linkError } = await ctx.db
		.from('profiles')
		.update({
			company_id: ctx.companyId,
			member_status: 'pending',
			full_name: fullName,
			email
		})
		.eq('id', created.user.id);
	if (linkError) error(500, linkError.message);

	await logFounderAction(ctx, `added ${fullName} to the team, pending TIC approval`, {
		table: 'profiles',
		recordId: created.user.id,
		after: { full_name: fullName, email, member_status: 'pending' }
	});

	return json({ ok: true, id: created.user.id });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireCompanyOwner(cookies, url.searchParams.get('companyId'));
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing member id.');
	if (id === ctx.founder.userId) {
		return json({ ok: false, error: 'You cannot remove yourself.' }, { status: 400 });
	}

	// Scoped to this company. The owner is not a row here at all — they are
	// companies.owner_id — so there is no way to remove them through this route.
	const { data, error: dbError } = await ctx.db
		.from('profiles')
		.select('full_name, email')
		.eq('id', id)
		.eq('company_id', ctx.companyId)
		.maybeSingle();

	if (dbError) error(500, dbError.message);
	if (!data) {
		return json({ ok: false, error: 'Member not found.' }, { status: 404 });
	}

	// The account itself goes: a person removed from the only company they
	// belonged to has nothing left to sign in to, and leaving the login alive
	// would be a door with no room behind it.
	const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
	if (deleteError) error(500, deleteError.message);

	await logFounderAction(
		ctx,
		`removed ${(data.full_name as string) || (data.email as string)} from the team`,
		{
			table: 'profiles',
			recordId: id
		}
	);

	return json({ ok: true });
};
