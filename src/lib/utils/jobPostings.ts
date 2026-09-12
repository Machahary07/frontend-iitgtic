// Job postings as the public boards read them.
//
// Startup Jobs is the union of the seed posts in content.json and every approved
// company posting. RLS does the gatekeeping: a row is visible here only once TIC
// has both verified the company and approved the posting, so a pending or
// rejected role cannot leak onto the board through this path.
//
// TIC Jobs is the centre's own openings, which are curated content rather than
// company submissions and never touch the table.
//
// Writing a posting lives in the founder console instead — /api/founder/jobs —
// because a posting's approval state must not be settable by its author.

import { getContent } from '$lib/content';
import { supabase } from '$lib/supabaseClient';

export type JobType = 'Full-time' | 'Internship';

export type PostedJob = {
	id: string;
	slug: string;
	companyId: string;
	role: string;
	company: string;
	companySlug: string;
	location: string;
	type: string;
	sector: string;
	posted: string;
	description: string;
	applyLink: string;
	createdAt: string;
	updatedAt: string;
};

export type AnyJob = PostedJob & { source: 'seed' | 'user' };

type JobRow = {
	id: string;
	company_id: string;
	slug: string;
	role: string;
	company: string;
	company_slug: string;
	location: string;
	type: string;
	sector: string;
	posted: string;
	description: string;
	apply_link: string;
	created_at: string;
	updated_at: string;
};

const COLUMNS =
	'id, company_id, slug, role, company, company_slug, location, type, sector, posted, description, apply_link, created_at, updated_at';

function toJob(row: JobRow): PostedJob {
	return {
		id: row.id,
		slug: row.slug,
		companyId: row.company_id,
		role: row.role,
		company: row.company,
		companySlug: row.company_slug,
		location: row.location,
		type: row.type,
		sector: row.sector,
		posted: row.posted,
		description: row.description,
		applyLink: row.apply_link,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

// A content-authored post (seed startup roles, and every TIC role) in the same
// shape the boards render.
type ContentPost = {
	slug: string;
	role: string;
	company: string;
	companySlug: string;
	location: string;
	type: string;
	sector: string;
	posted: string;
	description: string;
	applyLink: string;
};

function fromContent(p: ContentPost): AnyJob {
	return {
		id: `seed_${p.slug}`,
		slug: p.slug,
		companyId: '',
		role: p.role,
		company: p.company,
		companySlug: p.companySlug,
		location: p.location,
		type: p.type,
		sector: p.sector,
		posted: p.posted,
		description: p.description,
		applyLink: p.applyLink,
		createdAt: p.posted,
		updatedAt: p.posted,
		source: 'seed' as const
	};
}

// Roles at the incubation centre itself, edited in the admin console.
export function ticJobs(): AnyJob[] {
	return (getContent().pages.ticJobs.posts as ContentPost[]).map(fromContent).sort(byPostedDesc);
}

export function seedStartupJobs(): AnyJob[] {
	return getContent().pages.startupJobs.posts.map((p) => ({
		id: `seed_${p.slug}`,
		slug: p.slug,
		companyId: '',
		role: p.role,
		company: p.company,
		companySlug: p.companySlug,
		location: p.location,
		type: p.type,
		sector: p.sector,
		posted: p.posted,
		description: p.description,
		applyLink: p.applyLink,
		createdAt: p.posted,
		updatedAt: p.posted,
		source: 'seed' as const
	}));
}

function byPostedDesc(a: AnyJob, b: AnyJob) {
	return a.posted < b.posted ? 1 : a.posted > b.posted ? -1 : 0;
}

export async function getStartupJobs(): Promise<AnyJob[]> {
	const { data, error } = await supabase.from('jobs').select(COLUMNS).order('posted', {
		ascending: false
	});

	// A failed fetch should not blank the page — fall back to the seed posts.
	if (error) return seedStartupJobs();

	const live: AnyJob[] = (data as JobRow[]).map((row) => ({
		...toJob(row),
		source: 'user' as const
	}));
	return [...live, ...seedStartupJobs()].sort(byPostedDesc);
}

export async function getJob(slug: string): Promise<AnyJob | null> {
	// Both boards share /opportunities/[id] for the detail page, so a slug is
	// looked up across the centre's roles and the seed startup roles before the
	// table is queried.
	const authored = [...ticJobs(), ...seedStartupJobs()].find((j) => j.slug === slug);
	if (authored) return authored;

	const { data, error } = await supabase
		.from('jobs')
		.select(COLUMNS)
		.eq('slug', slug)
		.maybeSingle();

	if (error || !data) return null;
	return { ...toJob(data as JobRow), source: 'user' as const };
}
