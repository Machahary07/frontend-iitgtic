import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConsoleSession } from '$lib/server/sessionValidation';

// The review chain, server side: who sees an application at which step, and
// who may move it on. Stages are documented in the migration
// (20261006120823_application_review_chain.sql) and drawn by ReviewProgress.
//
// Every reader of applications in the console goes through visibleApplicationIds
// or canSeeApplication, so the list, the detail page, the API and the assistant
// all agree: the CEO sees nothing before admin passes it on, and a coordinator
// or head sees only what they were personally assigned, once it reaches them.

export type ReviewerKind = 'coordinator' | 'head';

/** How a role takes part in the chain. Chairman and president oversee it: they
 *  read everything and act on nothing. */
export type ReviewScope = 'admin' | 'ceo' | 'coordinator' | 'head' | 'observer';

export function reviewScope(admin: Pick<ConsoleSession, 'role'>): ReviewScope {
	switch (admin.role) {
		case 'developer':
		case 'admin':
		case 'tic_admin':
			return 'admin';
		case 'tic_ceo':
			return 'ceo';
		case 'tic_coordinator':
			return 'coordinator';
		case 'tic_head':
			return 'head';
		default:
			return 'observer';
	}
}

/** The first stage each narrowed role is allowed to see. */
const FIRST_SEEN: Partial<Record<ReviewScope, number>> = { ceo: 1, coordinator: 3, head: 5 };

export const APPLICATION_COLUMNS =
	'id, user_id, status, full_name, email, startup_name, applicant_message, review_note, review_stage, rejected_stage, reviewed_at, created_at, updated_at';

/** Ids this person may see, or null for "all of them". */
export async function visibleApplicationIds(
	db: SupabaseClient,
	admin: Pick<ConsoleSession, 'role' | 'userId'>
): Promise<string[] | null> {
	const scope = reviewScope(admin);
	if (scope === 'admin' || scope === 'observer') return null;

	if (scope === 'ceo') {
		const { data } = await db
			.from('applications')
			.select('id')
			.gte('review_stage', FIRST_SEEN.ceo!);
		return (data ?? []).map((row) => row.id as string);
	}

	const { data: assigned } = await db
		.from('application_reviewers')
		.select('application_id')
		.eq('user_id', admin.userId)
		.eq('kind', scope);
	const ids = (assigned ?? []).map((row) => row.application_id as string);
	if (ids.length === 0) return [];

	const { data } = await db
		.from('applications')
		.select('id')
		.in('id', ids)
		.gte('review_stage', FIRST_SEEN[scope]!);
	return (data ?? []).map((row) => row.id as string);
}

export async function canSeeApplication(
	db: SupabaseClient,
	admin: Pick<ConsoleSession, 'role' | 'userId'>,
	id: string
): Promise<boolean> {
	const ids = await visibleApplicationIds(db, admin);
	return ids === null || ids.includes(id);
}

/** The applications list, narrowed to what this person may see. */
export async function loadVisibleApplications(
	db: SupabaseClient,
	admin: Pick<ConsoleSession, 'role' | 'userId'>
) {
	const ids = await visibleApplicationIds(db, admin);
	if (ids !== null && ids.length === 0) return [];

	let query = db
		.from('applications')
		.select(APPLICATION_COLUMNS)
		.order('created_at', { ascending: false });
	if (ids !== null) query = query.in('id', ids);

	const { data } = await query;
	return data ?? [];
}

export type ReviewerRow = {
	id: string;
	user_id: string;
	kind: ReviewerKind;
	note: string | null;
	done_at: string | null;
	assigned_at: string;
	name: string;
	email: string;
};

export async function loadReviewers(db: SupabaseClient, applicationId: string) {
	const { data } = await db
		.from('application_reviewers')
		.select(
			'id, user_id, kind, note, done_at, assigned_at, profile:profiles!application_reviewers_user_id_fkey(full_name, email)'
		)
		.eq('application_id', applicationId)
		.order('assigned_at');
	return (data ?? []).map((row) => {
		const profile = (Array.isArray(row.profile) ? row.profile[0] : row.profile) as {
			full_name: string | null;
			email: string | null;
		} | null;
		return {
			id: row.id,
			user_id: row.user_id,
			kind: row.kind,
			note: row.note,
			done_at: row.done_at,
			assigned_at: row.assigned_at,
			name: profile?.full_name || '',
			email: profile?.email || ''
		} as ReviewerRow;
	});
}

/** Staff who can be assigned at a step, for the pickers. */
export async function loadAssignable(db: SupabaseClient, kind: ReviewerKind) {
	const { data } = await db
		.from('profiles')
		.select('id, full_name, email')
		.eq('role', kind === 'coordinator' ? 'tic_coordinator' : 'tic_head')
		.order('full_name');
	return (data ?? []).map((row) => ({
		id: row.id as string,
		name: (row.full_name as string) || (row.email as string) || 'Unnamed',
		email: (row.email as string) || ''
	}));
}
