import { reviewScope } from '$lib/server/applicationReview';
import { listAllProfiles } from '$lib/server/startupProfiles';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { canOpen } from '$lib/utils/roles';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const role = admin!.actor?.role ?? admin!.role;
	const [profiles, { data: companies }] = await Promise.all([
		listAllProfiles(),
		supabaseAdmin.from('companies').select('id, company_name')
	]);
	const companyName = new Map((companies ?? []).map((c) => [c.id as string, c.company_name as string]));

	return {
		profiles: profiles.map((p) => ({
			id: p.id,
			slug: p.slug,
			name: p.published?.name || p.draft.name || companyName.get(p.company_id ?? '') || p.slug,
			stage: p.stage,
			isVirtual: p.is_virtual,
			listed: p.listed,
			hasPublished: Boolean(p.published),
			status: p.draft_status,
			liveAt: p.live_at,
			graduatedAt: p.graduated_at,
			layout: (p.published ?? p.draft).layout
		})),
		canMove: reviewScope({ role }) === 'admin',
		canEdit: canOpen(role, 'content')
	};
};
