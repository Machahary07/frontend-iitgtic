import { founderDb } from '$lib/server/founderGuard';
import type { ApplicationDetail } from '$lib/utils/applications';
import type { PageServerLoad } from './$types';

// Once a startup has applied, this page is the record of what it sent, not a
// fresh form. The row is read with the service key and filtered to the startup
// in view by hand, like the overview — a member of the team must be able to see
// the application the owner submitted, which "applications: read mine" hides.
//
// review_note is TIC's private note and is never selected here; applicant_message
// is the line written for the founder.

export type DocumentLink = { field: string; name: string; size: number; url: string | null };

export const load: PageServerLoad = async ({ parent, url }) => {
	const { founder, activeCompanyId } = await parent();
	if (!activeCompanyId) return { application: null, documents: [] as DocumentLink[] };

	const db = founderDb(founder.userId);
	const { data } = await db
		.from('applications')
		.select(
			'id, status, startup_name, created_at, reviewed_at, applicant_message, full_name, email, answers, documents'
		)
		.eq('company_id', activeCompanyId)
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	const application = (data ?? null) as ApplicationDetail | null;

	// A declined startup may apply again; `?new` opens the form for that. Any
	// other standing keeps the submitted record in view, so a second application
	// cannot be started while the first is still with TIC.
	if (!application || (application.status === 'rejected' && url.searchParams.has('new'))) {
		return { application: null, documents: [] as DocumentLink[] };
	}

	// Signed here rather than in the browser: the storage policy only lets a user
	// sign files in their own folder, and a team member did not upload these.
	const documents: DocumentLink[] = await Promise.all(
		Object.entries(application.documents ?? {})
			.filter(([, entry]) => entry?.path)
			.map(async ([field, entry]) => {
				const { data: signed } = await db.storage
					.from('application-documents')
					.createSignedUrl(entry.path, 600);
				return { field, name: entry.name, size: entry.size, url: signed?.signedUrl ?? null };
			})
	);

	return { application, documents };
};
