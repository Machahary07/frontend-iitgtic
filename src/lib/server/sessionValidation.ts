import { error, type Cookies } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { clearTicAdminSession, readTicAdminSession } from '$lib/server/ticAdminSession';
import { clearFounderSession, readFounderSession } from '$lib/server/founderSession';

// Signed cookies establish identity, not current permission. Never cache this
// lookup across requests: bans, deletions and role changes must apply immediately.
export async function currentAccount(userId: string) {
	const { data, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
	if (authError) {
		if (authError.status === 404 || authError.code === 'user_not_found') return null;
		error(503, 'Unable to verify account status. Please try again.');
	}
	if (
		!data.user ||
		data.user.deleted_at ||
		(data.user.banned_until && Date.parse(data.user.banned_until) > Date.now())
	) return null;
	const { data: profile, error: profileError } = await supabaseAdmin
		.from('profiles')
		.select('role, full_name, email')
		.eq('id', userId)
		.maybeSingle();
	if (profileError) error(503, 'Unable to verify account permissions. Please try again.');
	if (!profile) return null;
	return {
		userId,
		role: profile.role as string,
		name: (profile.full_name as string) || '',
		email: (profile.email as string) || data.user.email || ''
	};
}

export async function validatedAdminSession(cookies: Cookies) {
	const session = readTicAdminSession(cookies);
	if (!session) return null;
	const account = await currentAccount(session.userId);
	if (!account || account.role !== 'admin') {
		clearTicAdminSession(cookies);
		return null;
	}
	return { userId: account.userId, name: account.name, email: account.email };
}

export async function validatedFounderSession(cookies: Cookies) {
	const session = readFounderSession(cookies);
	if (!session) return null;
	const account = await currentAccount(session.userId);
	if (!account) {
		clearFounderSession(cookies);
		return null;
	}
	return { userId: account.userId, name: account.name, email: account.email };
}
