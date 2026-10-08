import { error, json } from '@sveltejs/kit';
import { logAdminAction, requireAdmin, type AdminContext } from '$lib/server/adminGuard';
import {
	ACCOUNT_ROLES,
	canGrant,
	canManage,
	canSetPassword,
	FULL_ADMIN_ROLES,
	roleLabel,
	type AccountRole,
	type StaffRole
} from '$lib/utils/roles';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { removeApplicationDocuments } from '$lib/server/storageCleanup';
import { AFTER_PASSWORD_RESET, AUTH_CALLBACK_PATH } from '$lib/utils/authRedirect';
import { isValidPhone } from '$lib/utils/phone';
import { sendTemplateEmail } from '$lib/server/email';
import type { RequestHandler } from './$types';

// Account management. Roles, sign-in state and password resets all live here;
// every mutation is attributed to the acting admin through the guard's client.

type Details = {
	fullName: string;
	email: string;
	phone: string;
	responsibility: string;
	department: string;
};

// Every field is required when an account is created. An edit sends the whole
// form too, but a field it leaves out is simply not changed.
function readDetails(
	raw: Partial<Details>,
	{ requireAll }: { requireAll: boolean }
): Partial<Details> {
	const out: Partial<Details> = {};
	const text = (value: unknown) => (typeof value === 'string' ? value.trim() : undefined);

	const fullName = text(raw.fullName);
	const email = text(raw.email)?.toLowerCase();
	const phone = text(raw.phone);
	const responsibility = text(raw.responsibility);
	const department = text(raw.department);

	if (requireAll || fullName !== undefined) {
		if (!fullName) error(400, 'Name is required.');
		out.fullName = fullName;
	}
	if (requireAll || email !== undefined) {
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
			error(400, 'A valid email is required.');
		out.email = email;
	}
	if (requireAll || phone !== undefined) {
		if (!isValidPhone(phone)) error(400, 'Phone number must be exactly 10 digits.');
		out.phone = phone;
	}
	if (requireAll || responsibility !== undefined) {
		if (!responsibility) error(400, 'Responsibility / domain area is required.');
		out.responsibility = responsibility;
	}
	if (requireAll || department !== undefined) {
		if (!department) error(400, 'Department is required.');
		out.department = department;
	}
	return out;
}

const isFullAdmin = (role: unknown) => FULL_ADMIN_ROLES.includes(role as StaffRole);

// Counts the accounts that can still run the whole console, so the last one is
// never demoted or deleted and nobody is left locked out.
async function fullAdminCount(ctx: AdminContext): Promise<number> {
	const { count } = await ctx.db
		.from('profiles')
		.select('id', { count: 'exact', head: true })
		.in('role', FULL_ADMIN_ROLES);
	return count ?? 0;
}

export const PATCH: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);
	const body = (await request.json().catch(() => ({}))) as {
		id?: string;
		role?: string;
		banned?: boolean;
		details?: Partial<Details> & { password?: string };
	};
	if (!body.id) error(400, 'Missing user id.');

	// Judged on the real person, so viewing as someone never lends their rank.
	const actingRole = ctx.admin.actor?.role ?? ctx.admin.role;
	const { data: target } = await ctx.db
		.from('profiles')
		.select('role')
		.eq('id', body.id)
		.maybeSingle();
	if (!target) error(404, 'No such account.');
	if (body.id !== ctx.admin.userId && !canManage(actingRole, target.role)) {
		error(403, `A ${roleLabel(actingRole)} cannot change a ${roleLabel(target.role)} account.`);
	}

	if (body.details) {
		const details = readDetails(body.details, { requireAll: false });
		const password = body.details.password?.trim() ?? '';
		if (password && password.length < 8) error(400, 'A new password needs at least 8 characters.');
		if (password && !canSetPassword(actingRole, target.role)) {
			error(403, `A ${roleLabel(actingRole)} cannot set this account's password.`);
		}

		// The sign-in address and password live on the auth user; the rest on the
		// profile. Auth first, so a taken address fails before anything changes.
		const authChanges: { email?: string; password?: string } = {};
		if (details.email) authChanges.email = details.email;
		if (password) authChanges.password = password;
		if (Object.keys(authChanges).length) {
			const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(body.id, {
				...authChanges,
				...(authChanges.email ? { email_confirm: true } : {})
			});
			if (authError) error(400, authError.message);
		}

		const { error: profileError } = await ctx.db
			.from('profiles')
			.update({
				full_name: details.fullName,
				email: details.email,
				phone: details.phone,
				responsibility: details.responsibility,
				department: details.department
			})
			.eq('id', body.id);
		if (profileError) error(500, profileError.message);

		await logAdminAction(ctx, `updated the details of ${details.email ?? body.id}`, {
			table: 'profiles',
			recordId: body.id
		});
	}

	if (body.role !== undefined) {
		if (!ACCOUNT_ROLES.includes(body.role as AccountRole)) error(400, 'Unknown role.');

		// Removing your own rights would lock you out mid-session.
		if (body.id === ctx.admin.userId && body.role !== ctx.admin.role) {
			error(400, 'You cannot change your own role.');
		}

		// Nobody hands out a role above their own — so only a developer makes a
		// developer, the one role that can view as anyone.
		if (!canGrant(actingRole, body.role)) {
			error(403, `A ${roleLabel(actingRole)} cannot grant the ${roleLabel(body.role)} role.`);
		}

		// Never leave the console with no way back in. This only bites when the
		// account being changed is itself a full admin — demoting a founder must
		// not be blocked just because one admin happens to exist.
		if (isFullAdmin(target?.role) && !isFullAdmin(body.role)) {
			if ((await fullAdminCount(ctx)) <= 1) error(400, 'This is the last admin account.');
		}

		const { error: roleError } = await ctx.db
			.from('profiles')
			.update({ role: body.role })
			.eq('id', body.id);
		if (roleError) error(500, roleError.message);
		await logAdminAction(ctx, `changed role to ${roleLabel(body.role)}`, {
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
	const ctx = await requireAdmin(cookies);
	const body = (await request.json().catch(() => ({}))) as { email?: string; id?: string };
	if (!body.email) error(400, 'Missing email.');

	// /login had no way to spend a recovery token — it arrived as a fragment on a
	// page that ignored it, so the reset silently did nothing. It goes through the
	// auth callback now, which forwards to the form that can actually set a
	// password.
	const redirectTo = `${url.origin}${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(AFTER_PASSWORD_RESET)}`;

	const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(body.email, {
		redirectTo
	});
	if (resetError) error(500, resetError.message);

	await logAdminAction(ctx, `sent a password reset to ${body.email}`, {
		table: 'profiles',
		recordId: body.id
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireAdmin(cookies);

	// Clearing the note a founder left by closing their own account. The account
	// itself is already gone; this only tidies the Users page.
	const logId = url.searchParams.get('log');
	if (logId) {
		const { data: removedLog, error: logError } = await ctx.db
			.from('deleted_accounts')
			.delete()
			.eq('id', logId)
			.select('email')
			.maybeSingle();
		if (logError) error(500, logError.message);
		if (!removedLog) error(404, 'No such record.');
		await logAdminAction(ctx, `cleared the deleted-account record of ${removedLog.email}`, {
			table: 'deleted_accounts',
			recordId: logId
		});
		return json({ ok: true });
	}

	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing user id.');
	if (id === ctx.admin.userId) error(400, 'You cannot delete your own account.');

	const { data: profile } = await ctx.db
		.from('profiles')
		.select('role, email, full_name')
		.eq('id', id)
		.maybeSingle();

	if (isFullAdmin(profile?.role) && (await fullAdminCount(ctx)) <= 1) {
		error(400, 'This is the last admin account.');
	}
	if (!canManage(ctx.admin.actor?.role ?? ctx.admin.role, profile?.role)) {
		error(403, 'You cannot delete an account ranked above your own.');
	}

	await logAdminAction(ctx, `deleted the account ${profile?.email ?? id}`, {
		table: 'profiles',
		recordId: id
	});

	// Before the cascade, not after: once the auth user is gone so are the
	// application rows that name these files, and nothing can find them to
	// delete. They would sit in the private bucket forever.
	const removed = await removeApplicationDocuments(id);

	const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
	if (deleteError) error(500, deleteError.message);

	// A courtesy, so a login that suddenly stops working is explained. Never
	// fails the delete, which has already happened.
	if (profile?.email) {
		await sendTemplateEmail({
			templateKey: 'account-deleted',
			to: profile.email as string,
			toName: (profile.full_name as string) ?? '',
			variables: {
				fullName: ((profile.full_name as string) ?? '').split(' ')[0] ?? '',
				email: profile.email as string
			},
			context: { table: 'profiles', recordId: id },
			sentBy: ctx.admin.userId
		});
	}

	if (removed > 0) {
		await logAdminAction(ctx, `removed ${removed} uploaded document(s) with the account`, {
			table: 'profiles',
			recordId: id
		});
	}
	return json({ ok: true });
};

// Creates a member of TIC staff. Founders sign themselves up.
export const POST: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);
	const body = (await request.json().catch(() => ({}))) as Partial<Details> & {
		password?: string;
		role?: string;
	};
	const details = readDetails(body, { requireAll: true }) as Details;
	const role = (body.role ?? 'admin') as AccountRole;
	if (role === 'founder' || !ACCOUNT_ROLES.includes(role)) error(400, 'Unknown staff role.');
	if (!canGrant(ctx.admin.actor?.role ?? ctx.admin.role, role)) {
		error(403, `You cannot create a ${roleLabel(role)} account.`);
	}
	const email = details.email;
	if (!body.password || body.password.length < 8) {
		error(400, 'A password of at least 8 characters is required.');
	}

	const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
		email,
		password: body.password,
		email_confirm: true,
		user_metadata: { role, full_name: details.fullName }
	});
	if (createError || !data.user) error(400, createError?.message ?? 'Could not create account.');

	const { error: roleError } = await ctx.db
		.from('profiles')
		.update({
			role,
			email,
			full_name: details.fullName,
			phone: details.phone,
			responsibility: details.responsibility,
			department: details.department
		})
		.eq('id', data.user.id);
	if (roleError) error(500, roleError.message);

	await logAdminAction(ctx, `created the ${roleLabel(role)} account ${email}`, {
		table: 'profiles',
		recordId: data.user.id
	});
	return json({ ok: true, id: data.user.id });
};
