import { founderDb } from '$lib/server/founderGuard';
import type { ApplicationDetail, ReturnedApplication } from '$lib/utils/applications';
import { reapplyWaitUntil } from '$lib/utils/applicationReject';
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
	if (!activeCompanyId) {
		return {
			application: null,
			documents: [] as DocumentLink[],
			screening: null,
			returned: null,
			waitUntil: null
		};
	}

	const db = founderDb(founder.userId);
	const { data } = await db
		.from('applications')
		.select(
			'id, user_id, status, startup_name, created_at, reviewed_at, applicant_message, full_name, email, answers, documents, meet_url, meet_at, meeting_ended_at, reapply_from, reapply_allowed_at'
		)
		.eq('company_id', activeCompanyId)
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	const application = (data ?? null) as ApplicationDetail | null;

	// The screening call they are invited to, while it is still to happen.
	const screening =
		data?.meet_url && !data.meeting_ended_at && data.status !== 'rejected'
			? { meetUrl: data.meet_url as string, meetAt: (data.meet_at as string | null) ?? null }
			: null;

	// While the wait after a rejection runs, the date they may apply again from.
	// The insert policy refuses an early application too.
	const waitUntil = data ? reapplyWaitUntil(data) : null;

	// A declined startup may apply again once the wait is over; `?new` opens the
	// form for that. Any other standing keeps the submitted record in view, so a
	// second application cannot be started while the first is still with TIC.
	if (
		!application ||
		(application.status === 'rejected' && !waitUntil && url.searchParams.has('new'))
	) {
		return {
			application: null,
			documents: [] as DocumentLink[],
			screening: null,
			returned: null,
			waitUntil: null
		};
	}

	// Sent back by TIC: the founder who submitted it gets the form again, filled
	// in. Anyone else on the team sees the record, which says it was returned.
	if (application.status === 'returned' && data?.user_id === founder.userId) {
		const returned: ReturnedApplication = {
			id: application.id,
			answers: application.answers ?? {},
			documents: application.documents ?? {},
			note: application.applicant_message,
			returnedAt: application.reviewed_at
		};
		return {
			application: null,
			documents: [] as DocumentLink[],
			screening: null,
			returned,
			waitUntil: null
		};
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

	return { application, documents, screening, returned: null, waitUntil };
};
