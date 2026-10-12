import { adminDb } from '$lib/server/adminData';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { canOpen } from '$lib/utils/roles';
import type { PageServerLoad } from './$types';

// Everything a founder has sent up and is waiting on, in one queue. The two
// kinds are read separately because they live in different tables, and joined
// only by the company they belong to.

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);

	// New startups are not verified here any more: accepting their incubation
	// application verifies the company (see /api/tic-admin/applications).
	const [members, changes, companies, startups] = await Promise.all([
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
		db.from('companies').select('id, company_name, status'),
		supabaseAdmin
			.from('startup_profiles')
			.select('id, company_id, slug, draft, published, submitted_at')
			.eq('draft_status', 'in_review')
			.order('submitted_at', { ascending: true })
	]);

	return {
		pendingMembers: members.data ?? [],
		pendingChanges: changes.data ?? [],
		companies: companies.data ?? [],
		// Public profile changes: the name is read from the draft, which is what
		// is being approved.
		pendingProfiles: (startups.data ?? []).map((p) => ({
			id: p.id as string,
			name: ((p.draft as { name?: string })?.name as string) || (p.slug as string),
			isLive: Boolean(p.published),
			submittedAt: (p.submitted_at as string) ?? ''
		})),
		// Only staff who can edit site content may publish to it.
		canPublish: canOpen(admin!.role, 'content')
	};
};
