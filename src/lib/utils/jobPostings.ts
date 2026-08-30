// Job postings, backed by the public.jobs table.
//
// The public listing is the union of the eight seed posts in getContent().json and
// every live posting. RLS does the gatekeeping: the anon-readable policy only
// exposes jobs whose company is verified, and a signed-in company additionally
// sees its own postings whatever its status.

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

export function seedJobs(): AnyJob[] {
	return getContent().pages.opportunities.posts.map((p) => ({
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

export async function getAllJobs(): Promise<AnyJob[]> {
	const { data, error } = await supabase.from('jobs').select(COLUMNS).order('posted', {
		ascending: false
	});

	// A failed fetch should not blank the page — fall back to the seed posts.
	if (error) return seedJobs();

	const live: AnyJob[] = (data as JobRow[]).map((row) => ({
		...toJob(row),
		source: 'user' as const
	}));
	return [...live, ...seedJobs()].sort(byPostedDesc);
}

export async function getJob(slug: string): Promise<AnyJob | null> {
	const seed = seedJobs().find((j) => j.slug === slug);
	if (seed) return seed;

	const { data, error } = await supabase
		.from('jobs')
		.select(COLUMNS)
		.eq('slug', slug)
		.maybeSingle();

	if (error || !data) return null;
	return { ...toJob(data as JobRow), source: 'user' as const };
}

export async function getMyJobs(companyId: string): Promise<PostedJob[]> {
	const { data, error } = await supabase
		.from('jobs')
		.select(COLUMNS)
		.eq('company_id', companyId)
		.order('posted', { ascending: false });

	if (error || !data) return [];
	return (data as JobRow[]).map(toJob);
}

export async function getMyJobById(id: string, companyId: string): Promise<PostedJob | null> {
	const { data, error } = await supabase
		.from('jobs')
		.select(COLUMNS)
		.eq('id', id)
		.eq('company_id', companyId)
		.maybeSingle();

	if (error || !data) return null;
	return toJob(data as JobRow);
}

export type JobInput = {
	role: string;
	company: string;
	companySlug?: string;
	location: string;
	type: string;
	sector: string;
	description: string;
	applyLink: string;
};

function isSafeApplyLink(s: string) {
	const v = s.trim().toLowerCase();
	return v.startsWith('http://') || v.startsWith('https://') || v.startsWith('mailto:');
}

function slugifyCompany(value: string) {
	return (
		value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'company'
	);
}

export async function createJob(
	companyId: string,
	input: JobInput
): Promise<{ ok: true; job: PostedJob } | { ok: false; error: string }> {
	if (!input.role.trim() || !input.company.trim() || !input.description.trim()) {
		return { ok: false, error: 'Role, company and description are required.' };
	}
	if (!isSafeApplyLink(input.applyLink)) {
		return { ok: false, error: 'Apply link must start with https://, http:// or mailto:.' };
	}

	// slug and posted are filled by the column defaults (job-no-N from a sequence).
	const { data, error } = await supabase
		.from('jobs')
		.insert({
			company_id: companyId,
			role: input.role.trim(),
			company: input.company.trim(),
			company_slug: slugifyCompany(input.companySlug ?? input.company),
			location: input.location.trim(),
			type: input.type,
			sector: input.sector.trim(),
			description: input.description.trim(),
			apply_link: input.applyLink.trim()
		})
		.select(COLUMNS)
		.single();

	if (error) return { ok: false, error: friendlyDbError(error.message) };
	return { ok: true, job: toJob(data as JobRow) };
}

export async function updateJob(
	id: string,
	companyId: string,
	patch: Partial<JobInput>
): Promise<{ ok: true; job: PostedJob } | { ok: false; error: string }> {
	if (patch.applyLink !== undefined && !isSafeApplyLink(patch.applyLink)) {
		return { ok: false, error: 'Apply link must start with https://, http:// or mailto:.' };
	}

	const update: Record<string, string> = {};
	if (patch.role !== undefined) update.role = patch.role.trim();
	if (patch.company !== undefined) update.company = patch.company.trim();
	if (patch.companySlug !== undefined) update.company_slug = slugifyCompany(patch.companySlug);
	if (patch.location !== undefined) update.location = patch.location.trim();
	if (patch.type !== undefined) update.type = patch.type;
	if (patch.sector !== undefined) update.sector = patch.sector.trim();
	if (patch.description !== undefined) update.description = patch.description.trim();
	if (patch.applyLink !== undefined) update.apply_link = patch.applyLink.trim();

	const { data, error } = await supabase
		.from('jobs')
		.update(update)
		.eq('id', id)
		.eq('company_id', companyId)
		.select(COLUMNS)
		.maybeSingle();

	if (error) return { ok: false, error: friendlyDbError(error.message) };
	if (!data) return { ok: false, error: 'Job not found.' };
	return { ok: true, job: toJob(data as JobRow) };
}

export async function deleteJob(id: string, companyId: string): Promise<boolean> {
	const { error, count } = await supabase
		.from('jobs')
		.delete({ count: 'exact' })
		.eq('id', id)
		.eq('company_id', companyId);

	return !error && (count ?? 0) > 0;
}

function friendlyDbError(message: string): string {
	if (message.includes('jobs_apply_link_scheme')) {
		return 'Apply link must start with https://, http:// or mailto:.';
	}
	if (message.toLowerCase().includes('row-level security')) {
		return 'Your account is not verified yet, so it cannot post roles.';
	}
	return message;
}
