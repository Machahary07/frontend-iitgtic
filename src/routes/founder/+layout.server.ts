import { redirect } from '@sveltejs/kit';
import { founderDb, listMyCompanies } from '$lib/server/founderGuard';
import {
	issueFounderSession,
	readActiveCompany,
	setActiveCompany
} from '$lib/server/founderSession';
import type { LayoutServerLoad } from './$types';
import { validatedFounderSession } from '$lib/server/sessionValidation';

// The gate for the whole founder console, run once per request rather than in
// each page's onMount — so a page arrives already authenticated and already
// rendered, the same way /tic-admin does.
//
// It also re-reads the companies on every visit. A founder whose startup is
// verified while they are sitting on the waiting screen should see the console
// open up on their next click, not after signing out and back in.

export const load: LayoutServerLoad = async ({ cookies, url }) => {
	const session = await validatedFounderSession(cookies);
	if (!session) redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);

	const db = founderDb(session.userId);

	const { data: profile } = await db
		.from('profiles')
		.select('full_name, email, company_id, member_status')
		.eq('id', session.userId)
		.maybeSingle();

	const current = {
		userId: session.userId,
		name: (profile?.full_name as string) || session.name,
		email: (profile?.email as string) || session.email
	};

	// Sliding session: an active founder is never signed out on their own. Not
	// while a developer is viewing as them — that would hand the developer a
	// real founder cookie that outlives the view.
	if (!session.actor) issueFounderSession(cookies, current);

	const companies = await listMyCompanies(db, session.userId);

	// The remembered choice only counts if it is still one of theirs — a company
	// deleted, or a membership withdrawn, falls back to the first one they have.
	const remembered = readActiveCompany(cookies);
	const active = companies.find((c) => c.id === remembered) ?? companies[0] ?? null;
	if (active && active.id !== remembered) setActiveCompany(cookies, active.id);

	const company = active
		? ((
				await db
					.from('companies')
					.select(
						'id, email, company_name, company_slug, website, contact_name, contact_email, phone, status, rejection_reason, created_at'
					)
					.eq('id', active.id)
					.maybeSingle()
			).data ?? null)
		: null;

	return {
		// Read by AdminShell's view-as control, the same fields /tic-admin sends.
		canViewAs: Boolean(session.actor),
		viewAs: session.actor
			? { userId: current.userId, name: current.name, email: current.email, role: 'founder' }
			: null,
		founder: {
			...current,
			// Set only for someone who was added to a company rather than creating
			// one; it is what the waiting screen is about.
			memberOf: (profile?.company_id as string | null) ?? null,
			memberStatus: ((profile?.member_status as string) ?? 'approved') as
				'pending' | 'approved' | 'rejected'
		},
		companies,
		activeCompanyId: active?.id ?? null,
		relation: active?.relation ?? null,
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
