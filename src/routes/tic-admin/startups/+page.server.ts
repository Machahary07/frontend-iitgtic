import { reviewScope } from '$lib/server/applicationReview';
import { adminDb, loadIncubatedCompanies } from '$lib/server/adminData';
import { listAllProfiles } from '$lib/server/startupProfiles';
import { canOpen } from '$lib/utils/roles';
import { groupsFor } from '$lib/utils/startupProfile';
import type { PageServerLoad } from './$types';

// Incubatees: every accepted startup in one table — its company record (contact,
// status) and its page on the website (stage, virtual, profile review) side by
// side. Profiles carried over from the old hand-written listings have no company
// and appear on their own.
export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const role = admin!.actor?.role ?? admin!.role;
	const [companies, profiles] = await Promise.all([
		loadIncubatedCompanies(adminDb(admin!)),
		listAllProfiles()
	]);
	const byCompany = new Map(profiles.filter((p) => p.company_id).map((p) => [p.company_id!, p]));

	const profileView = (p: (typeof profiles)[number]) => {
		const group = p.listed && p.published && p.stage !== 'exited' ? groupsFor(p.stage, false)[0] : null;
		return {
			id: p.id,
			stage: p.stage,
			isVirtual: p.is_virtual,
			onSite: Boolean(group),
			hasPublished: Boolean(p.published),
			status: p.draft_status,
			layout: (p.published ?? p.draft).layout,
			liveAt: p.live_at,
			graduatedAt: p.graduated_at,
			// The live page when listed, otherwise the staff preview of the draft.
			viewHref: group ? `/incubated-startups/${group}/${p.slug}` : `/incubated-startups/preview/${p.id}`
		};
	};

	const rows = [
		...companies.map((c) => {
			const p = byCompany.get(c.id);
			return {
				key: c.id,
				name: c.companyName,
				company: c,
				profile: p ? profileView(p) : null
			};
		}),
		...profiles
			.filter((p) => !p.company_id)
			.map((p) => ({
				key: p.id,
				name: p.published?.name || p.draft.name || p.slug,
				company: null,
				profile: profileView(p)
			}))
	];

	return {
		rows,
		canMove: reviewScope({ role }) === 'admin',
		canEdit: canOpen(role, 'content')
	};
};
