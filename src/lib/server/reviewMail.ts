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
