import { redirect } from '@sveltejs/kit';
import { founderDb } from '$lib/server/founderGuard';
import { issueFounderSession, readFounderSession } from '$lib/server/founderSession';
import type { LayoutServerLoad } from './$types';

// The gate for the whole founder console, run once per request rather than in
// each page's onMount — so a page arrives already authenticated and already
// rendered, the same way /tic-admin does.
//
// It also re-reads the membership on every visit. A founder whose account is
// approved while they are sitting on the pending screen should see the console
// on their next click, not after signing out and back in.

export const load: LayoutServerLoad = async ({ cookies, url }) => {
	const session = readFounderSession(cookies);
	if (!session) redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);

	const db = founderDb(session.userId);

	const { data: profile } = await db
		.from('profiles')
		.select('full_name, email, company_id, member_role, member_status')
		.eq('id', session.userId)
		.maybeSingle();

	const current = {
		...session,
		name: (profile?.full_name as string) || session.name,
		email: (profile?.email as string) || session.email,
		companyId: (profile?.company_id as string | null) ?? session.companyId,
		memberRole: ((profile?.member_role as string) === 'member' ? 'member' : 'owner') as
			'owner' | 'member',
		memberStatus: ((profile?.member_status as string) ?? session.memberStatus) as
			'pending' | 'approved' | 'rejected'
	};

	// Sliding session, and a refresh of whatever TIC has changed since.
	issueFounderSession(cookies, current);

	const { data: company } = current.companyId
		? await db
				.from('companies')
				.select(
					'id, email, company_name, company_slug, website, contact_name, contact_email, phone, status, rejection_reason, created_at'
				)
				.eq('id', current.companyId)
				.maybeSingle()
		: { data: null };

	return {
		founder: current,
		company: company
			? {
					id: company.id as string,
					email: company.email as string,
					companyName: company.company_name as string,
					companySlug: company.company_slug as string,
					website: company.website as string,
					contactName: company.contact_name as string,
					contactEmail: company.contact_email as string,
					phone: company.phone as string,
					status: company.status as 'pending' | 'verified' | 'rejected',
					rejectionReason: (company.rejection_reason as string | null) ?? '',
					createdAt: company.created_at as string
				}
			: null
	};
};
