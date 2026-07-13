// Mock job-posting storage backed by localStorage.
// Merges seed posts from content.json with user-posted jobs.

import content from '$lib/data/content.json';
import { getAllCompanies } from '$lib/utils/companyAuth';

const JOBS_KEY = 'tic.jobs';

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

function isBrowser() {
	return typeof localStorage !== 'undefined';
}

function parseJobNumber(slug: string): number {
	const m = /^job-no-(\d+)$/.exec(slug);
	return m ? Number(m[1]) : 0;
}

function nextJobSlug(existing: PostedJob[]): string {
	const seedNums = content.pages.opportunities.posts.map((p) => parseJobNumber(p.slug));
	const userNums = existing.map((p) => parseJobNumber(p.slug));
	const max = Math.max(0, ...seedNums, ...userNums);
	return `job-no-${max + 1}`;
}

function readJobs(): PostedJob[] {
	if (!isBrowser()) return [];
	const raw = localStorage.getItem(JOBS_KEY);
	if (!raw) return [];
	try {
		return JSON.parse(raw) as PostedJob[];
	} catch {
		return [];
	}
}

function writeJobs(jobs: PostedJob[]) {
	if (!isBrowser()) return;
	localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

function seedJobs(): AnyJob[] {
	const seed = content.pages.opportunities.posts;
	return seed.map((p) => ({
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

export function getAllJobs(): AnyJob[] {
	const verifiedIds = new Set(
		getAllCompanies()
			.filter((c) => c.status === 'verified')
			.map((c) => c.id)
	);
	const user: AnyJob[] = readJobs()
		.filter((j) => verifiedIds.has(j.companyId))
		.map((j) => ({ ...j, source: 'user' as const }));
	const seed = seedJobs();
	const all = [...user, ...seed];
	return all.sort((a, b) => (a.posted < b.posted ? 1 : -1));
}

export function getJob(slug: string): AnyJob | null {
	return getAllJobs().find((j) => j.slug === slug) ?? null;
}

export function getMyJobs(companyId: string): PostedJob[] {
	return readJobs()
		.filter((j) => j.companyId === companyId)
		.sort((a, b) => (a.posted < b.posted ? 1 : -1));
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

export function createJob(
	companyId: string,
	input: JobInput
): { ok: true; job: PostedJob } | { ok: false; error: string } {
	if (!input.role.trim() || !input.company.trim() || !input.description.trim()) {
		return { ok: false, error: 'Role, company and description are required.' };
	}
	if (!isSafeApplyLink(input.applyLink)) {
		return { ok: false, error: 'Apply link must start with https://, http:// or mailto:.' };
	}
	const jobs = readJobs();
	const slug = nextJobSlug(jobs);
	const companySlug = (input.companySlug ?? input.company)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	const now = new Date().toISOString();
	const job: PostedJob = {
		id: 'j_' + Math.random().toString(36).slice(2, 10),
		slug,
		companyId,
		role: input.role.trim(),
		company: input.company.trim(),
		companySlug,
		location: input.location.trim(),
		type: input.type,
		sector: input.sector.trim(),
		posted: now.slice(0, 10),
		description: input.description.trim(),
		applyLink: input.applyLink.trim(),
		createdAt: now,
		updatedAt: now
	};
	writeJobs([job, ...jobs]);
	return { ok: true, job };
}

export function updateJob(
	id: string,
	companyId: string,
	patch: Partial<JobInput>
): { ok: true; job: PostedJob } | { ok: false; error: string } {
	if (patch.applyLink !== undefined && !isSafeApplyLink(patch.applyLink)) {
		return { ok: false, error: 'Apply link must start with https://, http:// or mailto:.' };
	}
	const jobs = readJobs();
	const idx = jobs.findIndex((j) => j.id === id && j.companyId === companyId);
	if (idx < 0) return { ok: false, error: 'Job not found.' };
	const current = jobs[idx];
	const updated: PostedJob = {
		...current,
		...patch,
		role: (patch.role ?? current.role).trim(),
		company: (patch.company ?? current.company).trim(),
		location: (patch.location ?? current.location).trim(),
		sector: (patch.sector ?? current.sector).trim(),
		description: (patch.description ?? current.description).trim(),
		applyLink: (patch.applyLink ?? current.applyLink).trim(),
		updatedAt: new Date().toISOString()
	};
	jobs[idx] = updated;
	writeJobs(jobs);
	return { ok: true, job: updated };
}

export function deleteJob(id: string, companyId: string): boolean {
	const jobs = readJobs();
	const filtered = jobs.filter((j) => !(j.id === id && j.companyId === companyId));
	if (filtered.length === jobs.length) return false;
	writeJobs(filtered);
	return true;
}

export function getMyJobById(id: string, companyId: string): PostedJob | null {
	return readJobs().find((j) => j.id === id && j.companyId === companyId) ?? null;
}
