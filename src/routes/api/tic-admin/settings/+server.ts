import { error, json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { logAdminAction, requireAdmin, type AdminContext } from '$lib/server/adminGuard';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { isValidPhone } from '$lib/utils/phone';
import type { RequestHandler } from './$types';

// A TIC team member's own settings: their details and their password. Always
// the signed-in person's own account — never someone they are viewing as.
//
//   PATCH { fullName, phone }                 update their details
//   POST  { currentPassword, newPassword }    change their password

const MIN_PASSWORD = 8;

function requireSelf(ctx: AdminContext) {
	if (ctx.admin.actor) error(403, 'Switch back to your own account to change its settings.');
}

export const PATCH: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);
	requireSelf(ctx);
	const body = (await request.json().catch(() => ({}))) as { fullName?: string; phone?: string };

	const fullName = body.fullName?.trim() ?? '';
	const phone = body.phone?.trim() ?? '';
	if (!fullName) error(400, 'Name is required.');
	if (phone && !isValidPhone(phone)) error(400, 'Phone number must be exactly 10 digits.');

	const { error: dbError } = await ctx.db
		.from('profiles')
		.update({ full_name: fullName, phone })
		.eq('id', ctx.admin.userId);
	if (dbError) error(500, dbError.message);

	await logAdminAction(ctx, 'updated their own details', {
		table: 'profiles',
		recordId: ctx.admin.userId
	});
	return json({ ok: true });
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);
	requireSelf(ctx);
	const body = (await request.json().catch(() => ({}))) as {
		currentPassword?: string;
		newPassword?: string;
	};
	const current = body.currentPassword ?? '';
	const next = body.newPassword ?? '';
	if (!current) error(400, 'Enter your current password.');
	if (next.length < MIN_PASSWORD) {
		error(400, `A new password needs at least ${MIN_PASSWORD} characters.`);
	}
	if (next === current) error(400, 'The new password is the same as the current one.');

	const { data: me } = await supabaseAdmin.auth.admin.getUserById(ctx.admin.userId);
	const email = me.user?.email;
	if (!email) error(400, 'This account has no sign-in email.');

	// The current password is checked by actually signing in with it, on a
	// throwaway client that keeps no session.
	const check = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
	const { error: wrong } = await check.auth.signInWithPassword({ email, password: current });
	if (wrong) error(400, 'Your current password is incorrect.');

	const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(ctx.admin.userId, {
		password: next
	});
	if (updateError) error(400, updateError.message);

	await logAdminAction(ctx, 'changed their own password', {
		table: 'profiles',
		recordId: ctx.admin.userId
	});
	return json({ ok: true });
};
