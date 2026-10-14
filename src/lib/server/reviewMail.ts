import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTemplateEmail } from '$lib/server/email';
import { REVIEW_STEP_NAMES } from '$lib/utils/emailBlocks';

// "An application needs your review" — the review-your-turn email, sent to
// whoever the chain hands an application to next. Never throws: a hand-off that
// went through must not be reported as failed because a notification did not.

type Recipient = { id: string; full_name: string | null; email: string | null };

export type ReviewHandOff = {
	db: SupabaseClient;
	siteUrl: string;
	sentBy: string;
	application: { id: string; startup_name: string | null; full_name: string | null };
	stage: number;
	ask: string;
	assignedBy?: string;
	/** Named people (assigned coordinators or heads)… */
	userIds?: string[];
	/** …or everyone holding these roles (the CEO, admin). */
	roles?: string[];
	/** Overrides the step name, e.g. "Final email" once the heads are done. */
	stageName?: string;
};

export type Rejection = {
	db: SupabaseClient;
	siteUrl: string;
	/** Who rejected it; they are not emailed. */
	rejectedBy: { userId: string; name: string; role: string };
	application: { id: string; startup_name: string | null; full_name: string | null };
	stage: number;
	stageName: string;
	reason: string;
	internalNote: string;
};

/** "An application was rejected", to the staff who worked on it: admin, the
 *  CEO once it had reached them, and the coordinators and heads assigned to it.
 *  Never the chairman, the president, developers or unassigned staff. Never
 *  throws, like notifyReviewers. */
export async function notifyRejection(rejection: Rejection): Promise<void> {
	try {
		const { db, application } = rejection;
		const { data: assigned } = await db
			.from('application_reviewers')
			.select('user_id')
			.eq('application_id', application.id);
		const assignedIds = (assigned ?? []).map((r) => r.user_id as string);

		const roles = ['admin', 'tic_admin', ...(rejection.stage >= 1 ? ['tic_ceo'] : [])];
		const [{ data: leads }, { data: reviewers }] = await Promise.all([
			db.from('profiles').select('id, full_name, email').in('role', roles),
			// Assigned people only while they still hold a reviewing role.
			assignedIds.length
				? db
						.from('profiles')
						.select('id, full_name, email')
						.in('id', assignedIds)
						.in('role', ['tic_coordinator', 'tic_head'])
				: Promise.resolve({ data: [] })
		]);

		const byId = new Map<string, Recipient>();
		for (const r of [...(leads ?? []), ...(reviewers ?? [])] as Recipient[]) byId.set(r.id, r);
		const recipients = [...byId.values()].filter(
			(r) => r.email && r.id !== rejection.rejectedBy.userId
		);

		await Promise.all(
			recipients.map((r) =>
				sendTemplateEmail({
					templateKey: 'application-rejected-team',
					to: r.email as string,
					toName: r.full_name ?? '',
					variables: {
						recipientName: (r.full_name ?? '').split(' ')[0] || 'there',
						startupName: application.startup_name || 'Untitled startup',
						founderName: application.full_name ?? '',
						rejectedBy: rejection.rejectedBy.name,
						rejectedByRole: rejection.rejectedBy.role,
						stageName: rejection.stageName,
						reason: rejection.reason,
						internalNote: rejection.internalNote,
						applicationUrl: `${rejection.siteUrl}/tic-admin/applications/${application.id}`
					},
					context: { table: 'applications', recordId: application.id },
					sentBy: rejection.rejectedBy.userId
				})
			)
		);
	} catch (err) {
		console.error('[email] could not tell the team about a rejection:', err);
	}
}

export async function notifyReviewers(handOff: ReviewHandOff): Promise<void> {
	const { db } = handOff;
	let query = db.from('profiles').select('id, full_name, email');
	if (handOff.userIds?.length) query = query.in('id', handOff.userIds);
	else if (handOff.roles?.length) query = query.in('role', handOff.roles);
	else return;

	const { data } = await query;
	const recipients = ((data ?? []) as Recipient[]).filter((r) => r.email);
	const stageName = handOff.stageName ?? REVIEW_STEP_NAMES[handOff.stage - 1] ?? '';

	await Promise.all(
		recipients.map((r) =>
			sendTemplateEmail({
				templateKey: 'review-your-turn',
				to: r.email as string,
				toName: r.full_name ?? '',
				variables: {
					recipientName: (r.full_name ?? '').split(' ')[0] || 'there',
					startupName: handOff.application.startup_name || 'Untitled startup',
					founderName: handOff.application.full_name ?? '',
					stage: String(handOff.stage),
					stageName,
					ask: handOff.ask,
					assignedBy: handOff.assignedBy ?? '',
					applicationUrl: `${handOff.siteUrl}/tic-admin/applications/${handOff.application.id}`
				},
				context: { table: 'applications', recordId: handOff.application.id },
				sentBy: handOff.sentBy
			})
		)
	);
}
