// Job postings: one table, two owners.
//
// owner 'tic' is the centre's own roles, written in the TIC console. owner
// 'incubatee' is a startup's roles, written in the founder console. Both go live
// the moment they are saved; the public boards read them server-side
// (src/lib/server/jobs.ts) and everyone applies through the same form.
//
// This file is shared by both consoles and the server routes: the shape of a
// posting, its fixed choices, and the one validation every write goes through.

export const JOB_TYPES = ['Full-time', 'Part-time', 'Internship'] as const;
export const WORK_MODES = ['On-site', 'Hybrid', 'Remote'] as const;

export type JobType = (typeof JOB_TYPES)[number];
export type WorkMode = (typeof WORK_MODES)[number];
export type JobOwner = 'tic' | 'incubatee';
export type JobStatus = 'open' | 'closed' | 'removed';

/** A posting as the public sees it. */
export type PublicJob = {
	id: string;
	slug: string;
	owner: JobOwner;
	role: string;
	company: string;
	location: string;
	type: JobType;
	workMode: WorkMode;
	pay: string;
	closesOn: string | null;
	sector: string;
	posted: string;
	description: string;
};

export const PUBLIC_JOB_COLUMNS =
	'id, slug, owner, role, company, location, type, work_mode, pay, closes_on, sector, posted, description';

export type PublicJobRow = {
	id: string;
	slug: string;
	owner: JobOwner;
	role: string;
	company: string;
	location: string;
	type: JobType;
	work_mode: WorkMode;
	pay: string;
	closes_on: string | null;
	sector: string;
	posted: string;
	description: string;
};

export function toPublicJob(row: PublicJobRow): PublicJob {
	return {
		id: row.id,
		slug: row.slug,
		owner: row.owner,
		role: row.role,
		company: row.company,
		location: row.location,
		type: row.type,
		workMode: row.work_mode,
		pay: row.pay,
		closesOn: row.closes_on,
		sector: row.sector,
		posted: row.posted,
		description: row.description
	};
}

/** What the posting form edits. */
export type JobFields = {
	role: string;
	company: string;
	type: JobType;
	workMode: WorkMode;
	location: string;
	sector: string;
	pay: string;
	closesOn: string;
	maxApplicants: number;
	description: string;
};

/** Every role closes itself at this many applicants; a poster may set fewer. */
export const MAX_APPLICANTS = 200;

export const EMPTY_JOB: JobFields = {
	role: '',
	company: '',
	type: 'Full-time',
	workMode: 'On-site',
	location: '',
	sector: '',
	pay: '',
	closesOn: '',
	maxApplicants: MAX_APPLICANTS,
	description: ''
};

/** Today in the site's time zone, as YYYY-MM-DD — what a closing date compares to. */
export function today(): string {
	return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Past its closing date: off the board, though nobody closed it. */
export function isExpired(closesOn: string | null): boolean {
	return Boolean(closesOn) && (closesOn as string) < today();
}

/**
 * The one check every write goes through, TIC's and founders' alike. Returns
 * the columns to write, or the first thing wrong with the input.
 */
export function cleanJob(
	input: Partial<Record<keyof JobFields, unknown>>,
	{ requireCompany }: { requireCompany: boolean }
): { ok: true; row: Record<string, string | number | null> } | { ok: false; error: string } {
	const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

	const role = str(input.role);
	const company = str(input.company);
	const description = str(input.description);
	const location = str(input.location);
	const closesOn = str(input.closesOn);
	const type = str(input.type) as JobType;
	const workMode = str(input.workMode) as WorkMode;
	const maxApplicants = Number(input.maxApplicants ?? MAX_APPLICANTS);

	if (!role) return { ok: false, error: 'Give the role a title.' };
	if (requireCompany && !company) return { ok: false, error: 'Company name is required.' };
	if (!JOB_TYPES.includes(type)) return { ok: false, error: 'Choose a type.' };
	if (!WORK_MODES.includes(workMode)) return { ok: false, error: 'Choose a work mode.' };
	if (!location) return { ok: false, error: 'Location is required.' };
	if (!description) return { ok: false, error: 'Describe the role.' };
	if (closesOn && !/^\d{4}-\d{2}-\d{2}$/.test(closesOn)) {
		return { ok: false, error: 'Closing date is not a valid date.' };
	}
	if (closesOn && closesOn < today()) {
		return { ok: false, error: 'Closing date is already past.' };
	}
	if (!Number.isInteger(maxApplicants) || maxApplicants < 1 || maxApplicants > MAX_APPLICANTS) {
		return { ok: false, error: `Application limit must be between 1 and ${MAX_APPLICANTS}.` };
	}

	return {
		ok: true,
		row: {
			role: role.slice(0, 160),
			...(requireCompany ? { company: company.slice(0, 160) } : {}),
			type,
			work_mode: workMode,
			location: location.slice(0, 160),
			sector: str(input.sector).slice(0, 160),
			pay: str(input.pay).slice(0, 120),
			closes_on: closesOn || null,
			max_applicants: maxApplicants,
			description: description.slice(0, 5000)
		}
	};
}
