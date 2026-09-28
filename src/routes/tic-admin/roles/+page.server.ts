import { adminDb } from '$lib/server/adminData';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { STAFF_ROLES, type AccountRole } from '$lib/utils/roles';
import type { PageServerLoad } from './$types';

// Who holds each staff role. Founders are only counted: they have their own
// console, and listing hundreds of them here would bury the staff.
export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);

	const [staffResult, founderResult, authResult] = await Promise.all([
		db
			.from('profiles')
			.select('id, role, full_name, email, phone, responsibility, department, created_at')
			.in('role', STAFF_ROLES as unknown as string[])
			.order('full_name', { ascending: true }),
		db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'founder'),
		supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
	]);

	const auth = new Map((authResult.data?.users ?? []).map((u) => [u.id, u]));

	const members = (staffResult.data ?? []).map((row) => {
		const user = auth.get(row.id as string);
		const bannedUntil = (user as { banned_until?: string | null } | undefined)?.banned_until;
		return {
			id: row.id as string,
			role: row.role as AccountRole,
			fullName: (row.full_name as string) ?? '',
			email: (row.email as string) || user?.email || '',
			phone: (row.phone as string) ?? '',
			responsibility: (row.responsibility as string) ?? '',
			department: (row.department as string) ?? '',
			createdAt: row.created_at as string,
			lastSignInAt: user?.last_sign_in_at ?? null,
			banned: Boolean(bannedUntil && new Date(bannedUntil) > new Date())
		};
	});

	return { members, founderCount: founderResult.count ?? 0 };
};
