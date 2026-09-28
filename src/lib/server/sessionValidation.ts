import { error, type Cookies } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { clearTicAdminSession, readTicAdminSession } from '$lib/server/ticAdminSession';
import { clearFounderSession, readFounderSession } from '$lib/server/founderSession';
import { readViewAs } from '$lib/server/viewAs';
import { isStaffRole, ROLE_INFO, type StaffRole } from '$lib/utils/roles';

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

export type Account = NonNullable<Awaited<ReturnType<typeof currentAccount>>>;

/** Who is using the console, and — while a developer is viewing as someone —
 *  who is really behind the keyboard. */
export type ConsoleSession = {
	userId: string;
	name: string;
	email: string;
	role: StaffRole;
	/** The developer viewing as this account, or null when it is really them. */
	actor: { userId: string; name: string; email: string; role: StaffRole } | null;
	/** The account a view-as names, whatever its role — including a founder,
	 *  whom the console cannot become but still has to show and let you exit. */
	viewing: { userId: string; name: string; email: string; role: string } | null;
};

// The account a developer's view-as cookie points at, once both halves check
// out: the cookie was set by this very session, and the person holding it may
// still view as. Anything else and the cookie is ignored.
async function viewAsTarget(cookies: Cookies, real: Account): Promise<Account | null> {
	const view = readViewAs(cookies);
	if (!view) return null;
	if (view.by !== real.userId || view.targetUserId === real.userId) return null;
	if (!isStaffRole(real.role) || !ROLE_INFO[real.role].viewAs) return null;
	return currentAccount(view.targetUserId);
}

export async function validatedAdminSession(cookies: Cookies): Promise<ConsoleSession | null> {
	const session = readTicAdminSession(cookies);
	if (!session) return null;
	const account = await currentAccount(session.userId);
	if (!account || !isStaffRole(account.role)) {
		clearTicAdminSession(cookies);
		return null;
	}
	const real = {
		userId: account.userId,
		name: account.name,
		email: account.email,
		role: account.role
	};

	const target = await viewAsTarget(cookies, account);
	const viewing = target
		? { userId: target.userId, name: target.name, email: target.email, role: target.role }
		: null;

	// Another member of staff: the console becomes theirs. A founder has no seat
	// in this console, so the developer stays themselves here and meets the
	// founder in /founder instead.
	if (target && isStaffRole(target.role)) {
		return { ...viewing!, role: target.role, actor: real, viewing };
	}
	return { ...real, actor: null, viewing };
}

export async function validatedFounderSession(cookies: Cookies) {
	// A developer viewing as a founder is shown that founder's console. Their own
	// admin session is what vouches for it; there is no founder cookie involved.
	const admin = readTicAdminSession(cookies);
	if (admin && readViewAs(cookies)) {
		const real = await currentAccount(admin.userId);
		const target = real ? await viewAsTarget(cookies, real) : null;
		if (real && target && !isStaffRole(target.role)) {
			return {
				userId: target.userId,
				name: target.name,
				email: target.email,
				actor: { userId: real.userId, name: real.name, email: real.email }
			};
		}
	}

	const session = readFounderSession(cookies);
	if (!session) return null;
	const account = await currentAccount(session.userId);
	if (!account) {
		clearFounderSession(cookies);
		return null;
	}
	return { userId: account.userId, name: account.name, email: account.email, actor: null };
}
