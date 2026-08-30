import { adminDb } from '$lib/server/adminData';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);

	const [authResult, profileResult, companyResult] = await Promise.all([
		supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
		db.from('profiles').select('id, role, full_name, email, phone, created_at'),
		db.from('companies').select('id, company_name, status')
	]);

	const byId = new Map((profileResult.data ?? []).map((p) => [p.id as string, p]));
	const companyById = new Map((companyResult.data ?? []).map((c) => [c.id as string, c]));

	const users = (authResult.data?.users ?? []).map((u) => {
		const profile = byId.get(u.id);
		const company = companyById.get(u.id);
		const bannedUntil = (u as { banned_until?: string | null }).banned_until;
		return {
			id: u.id,
			email: u.email ?? '',
			role: (profile?.role as 'founder' | 'company' | 'admin') ?? 'founder',
			fullName: (profile?.full_name as string) ?? '',
			phone: (profile?.phone as string) ?? '',
			createdAt: u.created_at,
			lastSignInAt: u.last_sign_in_at ?? null,
			emailConfirmed: Boolean(u.email_confirmed_at),
			banned: Boolean(bannedUntil && new Date(bannedUntil) > new Date()),
			companyName: (company?.company_name as string) ?? null,
			companyStatus: (company?.status as string) ?? null
		};
	});

	users.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
	return { users, currentAdminId: admin!.userId };
};
