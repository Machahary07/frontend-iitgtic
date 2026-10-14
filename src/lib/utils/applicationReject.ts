// Who may turn an application down, and when. Shared by the PATCH endpoint, the
// detail page and the list page, so all three agree. `scope` is reviewScope().

export type RejectRefusal = 'not-allowed' | 'rejected' | 'accepted' | 'with-ceo' | 'not-with-heads';

export const REJECT_REFUSALS: Record<RejectRefusal, string> = {
	'not-allowed': 'Not allowed.',
	rejected: 'This application is already rejected.',
	accepted: "An accepted application can't be rejected.",
	'with-ceo': "This application is with the CEO, so it can't be rejected right now.",
	'not-with-heads':
		'Only an assigned TIC head who has not signed off can reject it, while it is with the heads.'
};

/** Why this person cannot reject it right now, or null when they can. Admin
 *  steps back while it is with the CEO (stages 1, 2 and 4); a head may only at
 *  step 5, assigned to it and not yet signed off (`headPending`); coordinators
 *  never; and nobody once it is accepted. */
export function rejectRefusal(
	scope: string,
	stage: number,
	status: string,
	headPending = false
): RejectRefusal | null {
	if (scope !== 'admin' && scope !== 'ceo' && scope !== 'head') return 'not-allowed';
	if (status === 'rejected') return 'rejected';
	if (status === 'accepted' || stage === 6) return 'accepted';
	if (scope === 'admin' && (stage === 1 || stage === 2 || stage === 4)) return 'with-ceo';
	if (scope === 'head' && (stage !== 5 || status !== 'under-review' || !headPending))
		return 'not-with-heads';
	return null;
}

export const canReject = (scope: string, stage: number, status: string, headPending = false) =>
	rejectRefusal(scope, stage, status, headPending) === null;

/** How long a declined startup — and the founder behind it, under any company —
 *  waits before applying again. The PATCH endpoint stores the date as
 *  `reapply_from`, which the founder console and the insert policy both read. */
export const REAPPLY_WAIT_MONTHS = 3;

export function reapplyFrom(rejectedAt: Date): Date {
	const from = new Date(rejectedAt);
	from.setMonth(from.getMonth() + REAPPLY_WAIT_MONTHS);
	return from;
}

/** The date a declined application's startup may apply again, or null when it
 *  already may. */
export function reapplyWaitUntil(app: {
	status: string;
	reapply_from: string | null;
	reapply_allowed_at: string | null;
}): string | null {
	if (app.status !== 'rejected' || app.reapply_allowed_at || !app.reapply_from) return null;
	return new Date(app.reapply_from) > new Date() ? app.reapply_from : null;
}
