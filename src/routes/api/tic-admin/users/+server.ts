import { error, json } from '@sveltejs/kit';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import type { RequestHandler } from './$types';

// Account management. Roles, sign-in state and password resets all live here;
// every mutation is attributed to the acting admin through the guard's client.

const ROLES = ['founder', 'company', 'admin'] as const;
type Role = (typeof ROLES)[number];

export const PATCH: RequestHandler = async ({ cookies, request }) => {
	const ctx = requireAdmin(cookies);
	const body = (await request.json().catch(() => ({}))) as {
		id?: string;
		role?: string;
		banned?: boolean;
	};
	if (!body.id) error(400, 'Missing user id.');

	if (body.role !== undefined) {
		if (!ROLES.includes(body.role as Role)) error(400, 'Unknown role.');

		// Removing your own admin rights would lock you out mid-session.
		if (body.id === ctx.admin.userId && body.role !== 'admin') {
			error(400, 'You cannot remove your own admin role.');
		}

		// Never leave the console with no way back in. This only bites when the
		// account being changed is itself an admin — demoting a founder must not
		// be blocked just because one admin happens to exist.
		const { data: target } = await ctx.db
			.from('profiles')
			.select('role')
			.eq('id', body.id)
			.maybeSingle();

		if (target?.role === 'admin' && body.role !== 'admin') {
			const { count } = await ctx.db
				.from('profiles')
				.select('id', { count: 'exact', head: true })
				.eq('role', 'admin');
			if ((count ?? 0) <= 1) error(400, 'This is the last admin account.');
		}

		const { error: roleError } = await ctx.db
			.from('profiles')
			.update({ role: body.role })
			.eq('id', body.id);
		if (roleError) error(500, roleError.message);
		await logAdminAction(ctx, `changed role to ${body.role}`, {
			table: 'profiles',
			recordId: body.id
		});
	}

	if (body.banned !== undefined) {
		if (body.id === ctx.admin.userId) error(400, 'You cannot suspend your own account.');
		const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(body.id, {
			ban_duration: body.banned ? '87600h' : 'none'
		});
		if (banError) error(500, banError.message);
		await logAdminAction(ctx, body.banned ? 'suspended account' : 'restored account', {
			table: 'profiles',
			recordId: body.id
		});
	}

	return json({ ok: true });
};

// Sends the account a password-reset email. Admins never see or set another
// person's password — each account keeps its own.
export const PUT: RequestHandler = async ({ cookies, request, url }) => {
	const ctx = requireAdmin(cookies);
	const body = (await request.json().catch(() => ({}))) as { email?: string; id?: string };
	if (!body.email) error(400, 'Missing email.');

	const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(body.email, {
		redirectTo: `${url.origin}/login`
	});
	if (resetError) error(500, resetError.message);

	await logAdminAction(ctx, `sent a password reset to ${body.email}`, {
		table: 'profiles',
		recordId: body.id
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = requireAdmin(cookies);
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing user id.');
	if (id === ctx.admin.userId) error(400, 'You cannot delete your own account.');

	const { data: profile } = await ctx.db
		.from('profiles')
		.select('role, email')
		.eq('id', id)
		.maybeSingle();

	if (profile?.role === 'admin') {
		const { count } = await ctx.db
			.from('profiles')
			.select('id', { count: 'exact', head: true })
			.eq('role', 'admin');
		if ((count ?? 0) <= 1) error(400, 'This is the last admin account.');
	}

	await logAdminAction(ctx, `deleted the account ${profile?.email ?? id}`, {
		table: 'profiles',
		recordId: id
	});

	const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
	if (deleteError) error(500, deleteError.message);
	return json({ ok: true });
};

// Creates another admin. Ordinary founders and companies sign themselves up.
export const POST: RequestHandler = async ({ cookies, request }) => {
	const ctx = requireAdmin(cookies);
	const body = (await request.json().catch(() => ({}))) as {
		email?: string;
		password?: string;
		fullName?: string;
	};
	const email = body.email?.trim().toLowerCase();
	if (!email || !body.password || body.password.length < 8) {
		error(400, 'Email and a password of at least 8 characters are required.');
	}

	const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
		email,
		password: body.password,
		email_confirm: true,
		user_metadata: { role: 'admin', full_name: body.fullName?.trim() ?? '' }
	});
	if (createError || !data.user) error(400, createError?.message ?? 'Could not create account.');

	const { error: roleError } = await ctx.db
		.from('profiles')
		.update({ role: 'admin', full_name: body.fullName?.trim() ?? '', email })
		.eq('id', data.user.id);
	if (roleError) error(500, roleError.message);

	await logAdminAction(ctx, `created the admin account ${email}`, {
		table: 'profiles',
		recordId: data.user.id
	});
	return json({ ok: true, id: data.user.id });
};
