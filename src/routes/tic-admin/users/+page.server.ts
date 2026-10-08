import { adminDb } from '$lib/server/adminData';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { ROLE_INFO, type AccountRole } from '$lib/utils/roles';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);

	const [authResult, profileResult, companyResult, deletedResult] = await Promise.all([
		supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
		db
			.from('profiles')
			.select('id, role, full_name, email, phone, responsibility, department, created_at'),
		db.from('companies').select('id, owner_id, company_name, status'),
		// Accounts their owners closed themselves — gone from auth, so this note is
		// all that is left to show.
		db
			.from('deleted_accounts')
			.select('id, email, full_name, role, companies, joined_at, deleted_at')
			.order('deleted_at', { ascending: false })
	]);

	const byId = new Map((profileResult.data ?? []).map((p) => [p.id as string, p]));

	// A founder may run several startups, so this is a list per owner rather than
	// a lookup by account id — the two stopped being the same thing when a
	// company became something you create rather than something you log in as.
	const ownedBy = new Map<string, { company_name: string; status: string }[]>();
	for (const row of companyResult.data ?? []) {
		const owner = row.owner_id as string;
		if (!owner) continue;
		const list = ownedBy.get(owner) ?? [];
		list.push({ company_name: row.company_name as string, status: row.status as string });
		ownedBy.set(owner, list);
	}

	const users = (authResult.data?.users ?? []).map((u) => {
		const profile = byId.get(u.id);
		const companies = ownedBy.get(u.id) ?? [];
		const bannedUntil = (u as { banned_until?: string | null }).banned_until;
		return {
			id: u.id,
			email: u.email ?? '',
			role: (profile?.role as AccountRole) ?? 'founder',
			fullName: (profile?.full_name as string) ?? '',
			phone: (profile?.phone as string) ?? '',
			responsibility: (profile?.responsibility as string) ?? '',
			department: (profile?.department as string) ?? '',
			createdAt: u.created_at,
			lastSignInAt: u.last_sign_in_at ?? null,
			emailConfirmed: Boolean(u.email_confirmed_at),
			banned: Boolean(bannedUntil && new Date(bannedUntil) > new Date()),
			companies: companies.map((c) => ({ name: c.company_name, status: c.status }))
		};
	});

	// Developer accounts are invisible to everyone but developers — the role,
	// and who holds it, is not something the rest of the console manages.
	const visible = ROLE_INFO[admin!.role].viewAs
		? users
		: users.filter((u) => u.role !== 'developer');

	visible.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
	const deletedAccounts = (deletedResult.data ?? []).map((row) => ({
		id: row.id as string,
		email: row.email as string,
		fullName: row.full_name as string,
		role: row.role as AccountRole,
		companies: (row.companies as string[]) ?? [],
		joinedAt: (row.joined_at as string | null) ?? null,
		deletedAt: row.deleted_at as string
	}));

	return { users: visible, deletedAccounts, currentAdminId: admin!.userId };
};
