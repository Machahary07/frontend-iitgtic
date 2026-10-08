import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConsoleSession } from '$lib/server/sessionValidation';
import { adminDb, loadIncubatedCompanies, loadJobApplications } from '$lib/server/adminData';
import { loadVisibleApplications, reviewScope } from '$lib/server/applicationReview';
import { SCORED_STEPS } from '$lib/utils/applicationScores';

// The Overview, cut to what each role actually acts on. Admin runs the whole
// pipeline; the CEO only sees what is waiting on the CEO; a coordinator their
// screening calls; a head their reviews; the chairman and president a read-only
// picture of where everything stands.

export type OverviewIcon =
	'inbox' | 'clock' | 'video' | 'send' | 'rocket' | 'badge' | 'users' | 'check' | 'x' | 'search';

export type OverviewTile = {
	label: string;
	value: number;
	tone: 'neutral' | 'info' | 'good' | 'warn' | 'bad' | 'violet';
	icon: OverviewIcon;
	href?: string;
	cta?: string;
};

export type OverviewRow = {
	id: string;
	title: string;
	meta: string;
	href: string;
	cta: string;
	/** e.g. "Scored 3/7" — what is left before it can be passed on. */
	note?: string;
};

export type OverviewList = {
	title: string;
	empty: string;
	more?: { href: string; label: string };
	rows: OverviewRow[];
};

export type Overview = { intro: string; tiles: OverviewTile[]; lists: OverviewList[] };

type App = {
	id: string;
	status: string;
	startup_name: string | null;
	full_name: string | null;
	email: string | null;
	review_stage: number;
	created_at: string;
	reviewed_at: string | null;
};

const appHref = (id: string) => `/tic-admin/applications/${id}`;
const name = (a: App) => a.startup_name || 'Untitled startup';
const day = (iso: string | null) =>
	iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

// How many steps this person has scored on each application, for the
// "Scored 3/7" hint on rows they still have to pass on.
async function scoredCounts(db: SupabaseClient, userId: string, ids: string[]) {
	const counts = new Map<string, number>();
	if (!ids.length) return counts;
	const { data } = await db
		.from('application_scores')
		.select('application_id')
		.eq('user_id', userId)
		.in('application_id', ids);
	for (const row of data ?? []) {
		const id = row.application_id as string;
		counts.set(id, (counts.get(id) ?? 0) + 1);
	}
	return counts;
}

function scoreNote(counts: Map<string, number>, id: string) {
	const done = counts.get(id) ?? 0;
	return done >= SCORED_STEPS.length ? 'Scored' : `Scored ${done}/${SCORED_STEPS.length}`;
}

export async function loadOverview(admin: ConsoleSession): Promise<Overview> {
	const db = adminDb(admin);
	const scope = reviewScope(admin);
	const apps = ((await loadVisibleApplications(db, admin)) as App[]).filter(
		(a) => a.status !== 'rejected' || scope === 'admin' || scope === 'observer'
	);
	const live = apps.filter((a) => a.status !== 'rejected');
	const at = (stage: number) => live.filter((a) => a.review_stage === stage);

	// ---- CEO ------------------------------------------------------------------
	if (scope === 'ceo') {
		const fresh = at(1);
		const reviewing = at(2);
		const recheck = at(4);
		const mine = [...fresh, ...reviewing, ...recheck];
		const counts = await scoredCounts(
			db,
			admin.userId,
			mine.map((a) => a.id)
		);
		return {
			intro: 'Applications waiting on you. Score every step, then pass each one on.',
			tiles: [
				{ label: 'New for you', value: fresh.length, tone: 'warn', icon: 'inbox' },
				{ label: 'In your review', value: reviewing.length, tone: 'info', icon: 'clock' },
				{ label: 'Back for recheck', value: recheck.length, tone: 'violet', icon: 'search' },
				{ label: 'With coordinators', value: at(3).length, tone: 'neutral', icon: 'video' },
				{ label: 'With TIC heads', value: at(5).length, tone: 'neutral', icon: 'users' }
			],
			lists: [
				{
					title: 'Needs you',
					empty: 'Nothing is waiting on you right now.',
					more: { href: '/tic-admin/applications', label: 'All applications →' },
					rows: mine.map((a) => ({
						id: a.id,
						title: name(a),
						meta: `${a.full_name || a.email || ''} · ${
							a.review_stage === 4
								? 'recheck, then assign TIC heads'
								: 'review, then assign coordinators'
						}`,
						href: appHref(a.id),
						cta: a.review_stage === 1 ? 'Open' : 'Continue',
						note: scoreNote(counts, a.id)
					}))
				}
			]
		};
	}

	// ---- coordinator ------------------------------------------------------------
	if (scope === 'coordinator') {
		const { data: rows } = await db
			.from('application_reviewers')
			.select('application_id, done_at')
			.eq('user_id', admin.userId)
			.eq('kind', 'coordinator');
		const done = new Set(
			(rows ?? []).filter((r) => r.done_at).map((r) => r.application_id as string)
		);
		const open = at(3).filter((a) => !done.has(a.id));
		const { data: meets } = open.length
			? await db
					.from('applications')
					.select('id, meet_url, meet_at')
					.in(
						'id',
						open.map((a) => a.id)
					)
			: { data: [] };
		const meetOf = new Map((meets ?? []).map((m) => [m.id as string, m]));
		const scheduled = open.filter((a) => meetOf.get(a.id)?.meet_url);
		return {
			intro: 'Your screening calls. Join, score each criterion, and submit.',
			tiles: [
				{
					label: 'Calls to attend',
					value: scheduled.length,
					tone: 'warn',
					icon: 'video',
					href: '/tic-admin/evaluation',
					cta: 'Open Evaluation'
				},
				{
					label: 'Waiting for a meeting',
					value: open.length - scheduled.length,
					tone: 'info',
					icon: 'clock'
				},
				{ label: 'Submitted', value: done.size, tone: 'good', icon: 'check' }
			],
			lists: [
				{
					title: 'Your screening calls',
					empty: 'No screening calls assigned to you right now.',
					more: { href: '/tic-admin/evaluation', label: 'Evaluation →' },
					rows: open.map((a) => {
						const meet = meetOf.get(a.id);
						return {
							id: a.id,
							title: name(a),
							meta: meet?.meet_at
								? `Meeting ${new Date(meet.meet_at as string).toLocaleString('en-GB', {
										day: 'numeric',
										month: 'short',
										hour: '2-digit',
										minute: '2-digit'
									})}`
								: 'Waiting for admin to set up the meeting',
							href: '/tic-admin/evaluation',
							cta: meet?.meet_url ? 'Score' : 'View'
						};
					})
				}
			]
		};
	}

	// ---- TIC head ---------------------------------------------------------------
	if (scope === 'head') {
		const { data: rows } = await db
			.from('application_reviewers')
			.select('application_id, done_at')
			.eq('user_id', admin.userId)
			.eq('kind', 'head');
		const done = new Set(
			(rows ?? []).filter((r) => r.done_at).map((r) => r.application_id as string)
		);
		const open = at(5).filter((a) => !done.has(a.id));
		const counts = await scoredCounts(
			db,
			admin.userId,
			open.map((a) => a.id)
		);
		return {
			intro: 'Applications assigned to you. Score every step, then sign off.',
			tiles: [
				{ label: 'To review', value: open.length, tone: 'warn', icon: 'inbox' },
				{ label: 'Signed off', value: done.size, tone: 'good', icon: 'check' }
			],
			lists: [
				{
					title: 'Your reviews',
					empty: 'Nothing assigned to you right now.',
					rows: open.map((a) => ({
						id: a.id,
						title: name(a),
						meta: `${a.full_name || a.email || ''} · assigned ${day(a.reviewed_at)}`,
						href: appHref(a.id),
						cta: 'Review',
						note: scoreNote(counts, a.id)
					}))
				}
			]
		};
	}

	// ---- chairman / president: read-only picture --------------------------------
	if (scope === 'observer') {
		const companies = await loadIncubatedCompanies(db);
		const recent = [...apps]
			.sort((a, b) => ((a.reviewed_at ?? a.created_at) < (b.reviewed_at ?? b.created_at) ? 1 : -1))
			.slice(0, 6);
		const STAGE = [
			'Admin check',
			'CEO review',
			'CEO review',
			'Screening call',
			'CEO recheck',
			'TIC heads',
			'Live'
		];
		return {
			intro: 'Where every application stands.',
			tiles: [
				{ label: 'Admin check', value: at(0).length, tone: 'neutral', icon: 'inbox' },
				{
					label: 'With the CEO',
					value: at(1).length + at(2).length + at(4).length,
					tone: 'info',
					icon: 'clock'
				},
				{ label: 'Screening calls', value: at(3).length, tone: 'violet', icon: 'video' },
				{ label: 'With TIC heads', value: at(5).length, tone: 'warn', icon: 'users' },
				{ label: 'Incubated', value: companies.length, tone: 'good', icon: 'badge' },
				{
					label: 'Rejected',
					value: apps.filter((a) => a.status === 'rejected').length,
					tone: 'bad',
					icon: 'x'
				}
			],
			lists: [
				{
					title: 'Recent activity',
					empty: 'No applications yet.',
					more: { href: '/tic-admin/applications', label: 'All applications →' },
					rows: recent.map((a) => ({
						id: a.id,
						title: name(a),
						meta: `${a.status === 'rejected' ? 'Rejected' : (STAGE[a.review_stage] ?? '')} · ${day(a.reviewed_at ?? a.created_at)}`,
						href: appHref(a.id),
						cta: 'Open'
					}))
				}
			]
		};
	}

	// ---- admin: the whole pipeline ------------------------------------------------
	const [companies, jobApplicants, { data: reviewerRows }, { data: meetRows }] = await Promise.all([
		loadIncubatedCompanies(db),
		loadJobApplications(db),
		db
			.from('application_reviewers')
			.select('application_id, kind, done_at')
			.in(
				'application_id',
				live.filter((a) => a.review_stage === 3 || a.review_stage === 5).map((a) => a.id)
			),
		db
			.from('applications')
			.select('id, meet_url')
			.in(
				'id',
				at(3).map((a) => a.id)
			)
	]);
	const allDone = (id: string, kind: string) => {
		const mine = (reviewerRows ?? []).filter((r) => r.application_id === id && r.kind === kind);
		return mine.length > 0 && mine.every((r) => r.done_at);
	};
	const hasMeet = new Set((meetRows ?? []).filter((m) => m.meet_url).map((m) => m.id as string));

	const toCheck = at(0);
	const toSetUp = at(3).filter((a) => !hasMeet.has(a.id));
	const toEnd = at(3).filter((a) => hasMeet.has(a.id) && allDone(a.id, 'coordinator'));
	const toAccept = at(5).filter((a) => a.status !== 'accepted' && allDone(a.id, 'head'));
	const toLaunch = at(5).filter((a) => a.status === 'accepted');
	const counts = await scoredCounts(
		db,
		admin.userId,
		[...toCheck, ...toAccept].map((a) => a.id)
	);
	const newApplicants = (
		jobApplicants as {
			id: string;
			status: string;
			full_name: string;
			job_role: string;
			job_company: string;
			created_at: string;
		}[]
	).filter((a) => Date.now() - Date.parse(a.created_at) < 7 * 86_400_000);

	const actions: OverviewRow[] = [
		...toCheck.map((a) => ({
			id: a.id,
			title: name(a),
			meta: `New · ${day(a.created_at)} · check and pass to the CEO`,
			href: appHref(a.id),
			cta: 'Check',
			note: scoreNote(counts, a.id)
		})),
		...toSetUp.map((a) => ({
			id: a.id,
			title: name(a),
			meta: 'Coordinators assigned · set up the screening call',
			href: '/tic-admin/evaluation',
			cta: 'Set up'
		})),
		...toEnd.map((a) => ({
			id: a.id,
			title: name(a),
			meta: 'Every coordinator submitted · end the meeting',
			href: '/tic-admin/evaluation',
			cta: 'End meeting'
		})),
		...toAccept.map((a) => ({
			id: a.id,
			title: name(a),
			meta: 'Every head signed off · send the final email',
			href: appHref(a.id),
			cta: 'Decide',
			note: scoreNote(counts, a.id)
		})),
		...toLaunch.map((a) => ({
			id: a.id,
			title: name(a),
			meta: 'Accepted · mark it live once it is listed',
			href: appHref(a.id),
			cta: 'Mark live'
		}))
	];

	return {
		intro: 'Everything waiting on admin across the pipeline.',
		tiles: [
			{
				label: 'New to check',
				value: toCheck.length,
				tone: 'warn',
				icon: 'inbox',
				href: '/tic-admin/applications',
				cta: 'Review'
			},
			{
				label: 'Screening calls',
				value: at(3).length,
				tone: 'violet',
				icon: 'video',
				href: '/tic-admin/evaluation',
				cta: 'Evaluation'
			},
			{ label: 'Ready for final email', value: toAccept.length, tone: 'info', icon: 'send' },
			{ label: 'Ready to go live', value: toLaunch.length, tone: 'good', icon: 'rocket' },
			{
				label: 'Incubated companies',
				value: companies.length,
				tone: 'good',
				icon: 'badge',
				href: '/tic-admin/companies',
				cta: 'View all'
			},
			{
				label: 'Job responses this week',
				value: newApplicants.length,
				tone: 'neutral',
				icon: 'users',
				href: '/tic-admin/job-applications',
				cta: 'Review'
			}
		],
		lists: [
			{
				title: 'Needs admin',
				empty: 'Nothing in the pipeline is waiting on admin.',
				more: { href: '/tic-admin/applications', label: 'All applications →' },
				rows: actions
			},
			{
				title: 'Job responses this week',
				empty: 'No one applied to a TIC role this week.',
				more: { href: '/tic-admin/job-applications', label: 'All responses →' },
				rows: newApplicants.slice(0, 5).map((a) => ({
					id: a.id,
					title: a.full_name,
					meta: `${a.job_role} · ${a.job_company} · ${day(a.created_at)}`,
					href: `/tic-admin/job-applications/${a.id}`,
					cta: 'Open'
				}))
			}
		]
	};
}
