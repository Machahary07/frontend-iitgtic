import { adminDb } from '$lib/server/adminData';
import type { PageServerLoad } from './$types';

// Everything a founder has sent up and is waiting on, in one queue. The two
// kinds are read separately because they live in different tables, and joined
// only by the company they belong to.

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);

	// New startups are not verified here any more: accepting their incubation
	// application verifies the company (see /api/tic-admin/applications).
	const [members, changes, companies] = await Promise.all([
		db
			.from('profiles')
			.select('id, company_id, full_name, email, created_at')
			.eq('member_status', 'pending')
			.eq('member_role', 'member')
			.order('created_at', { ascending: true }),
		db
			.from('company_profile_changes')
			.select('id, company_id, changes, created_at')
			.eq('status', 'pending')
			.order('created_at', { ascending: true }),
		db.from('companies').select('id, company_name, status')
	]);

	return {
		pendingMembers: members.data ?? [],
		pendingChanges: changes.data ?? [],
		companies: companies.data ?? []
	};
};
