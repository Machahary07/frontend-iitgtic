// Keeps an in-progress incubation application across a refresh.
//
// The form is eight steps and around forty questions. Until now a refresh, a
// closed tab or a flat battery lost all of it — the row in public.applications
// is only written on submit, so there was nothing to come back to.
//
// The draft lives in localStorage rather than in the database. It is one
// person's unfinished writing on one device, it changes on every keystroke, and
// sending each of those to Postgres would be a write storm for something nobody
// else ever reads. The submitted application is still the durable record.
//
// Two things are deliberately not saved:
//
//   * the four uploads — a File cannot be serialised, and re-reading one from
//     disk without the user picking it again is not something a browser allows.
//     The UI says so, so nobody assumes their pitch deck came back.
//   * the consent checkboxes — an agreement restored from storage was never
//     actually given. They are re-ticked on the final step, deliberately.

const VERSION = 1;
const FILE_FIELDS = [
	'pitchDeck',
	'founderCv',
	'financialProjections',
	'incorporationCert'
] as const;
const CONSENT_FIELDS = ['infoAccurate', 'agreeTerms', 'allowReview'] as const;

// Keyed per account: a shared machine must not show one founder the other's
// half-written application.
function keyFor(userId: string): string {
	return `iitgtic:application-draft:${userId}`;
}

export type Draft = {
	version: number;
	savedAt: string;
	step: number;
	completedSteps: number[];
	values: Record<string, unknown>;
};

function stripped(values: Record<string, unknown>): Record<string, unknown> {
	const out = { ...values };
	for (const field of FILE_FIELDS) delete out[field];
	for (const field of CONSENT_FIELDS) delete out[field];
	return out;
}

/**
 * Writes the draft. Never throws: storage can be full, or disabled entirely in
 * a private window, and neither should interrupt someone filling in a form.
 */
export function saveDraft(
	userId: string,
	values: Record<string, unknown>,
	step: number,
	completedSteps: number[]
): void {
	if (!userId) return;
	try {
		const draft: Draft = {
			version: VERSION,
			savedAt: new Date().toISOString(),
			step,
			completedSteps,
			values: stripped(values)
		};
		localStorage.setItem(keyFor(userId), JSON.stringify(draft));
	} catch {
		// Out of quota or storage blocked — the form still works, it just will not
		// survive a refresh. Not worth interrupting anyone over.
	}
}

export function loadDraft(userId: string): Draft | null {
	if (!userId) return null;
	try {
		const raw = localStorage.getItem(keyFor(userId));
		if (!raw) return null;

		const draft = JSON.parse(raw) as Draft;
		// A draft written by an older shape of this form is discarded rather than
		// half-applied: a stale field is worse than starting the step again.
		if (draft.version !== VERSION || typeof draft.values !== 'object') return null;
		return draft;
	} catch {
		return null;
	}
}

export function clearDraft(userId: string): void {
	if (!userId) return;
	try {
		localStorage.removeItem(keyFor(userId));
	} catch {
		// Nothing to do — a draft that cannot be cleared is also one that was
		// probably never written.
	}
}

/** "just now", "12 minutes ago", "yesterday" — for the restored-draft notice. */
export function savedAgo(iso: string): string {
	const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
	if (seconds < 60) return 'just now';

	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

	const days = Math.round(hours / 24);
	return days === 1 ? 'yesterday' : `${days} days ago`;
}
