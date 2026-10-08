// The company's own view of who applied to its roles.
//
// public.job_applications was service-role only until now — every read went
// through the TIC console. The row already carries company_id, so a policy can
// hand each verified company its own slice, and this reads it with the ordinary
// browser client rather than through a server route.
//
// Read-only: an application is received and read, never moved through stages.
// The company has a select grant on this table and nothing else.

import { supabase } from '$lib/supabaseClient';

export type ApplicantStatus = 'new' | 'shortlisted' | 'forwarded' | 'rejected';

export type CompanyApplicant = {
	id: string;
	jobSlug: string;
	jobRole: string;
	fullName: string;
	email: string;
	phone: string;
	applicantRole: string;
	portfolioLink: string;
	why: string;
	startDate: string | null;
	onsiteOk: boolean;
	status: ApplicantStatus;
	createdAt: string;
	resumePath: string | null;
	resumeName: string;
};

// Named explicitly rather than `*`: the grant is column-level, so a wildcard is
// rejected outright — which is what keeps a column added later from leaking to
// companies by default.
const COLUMNS =
	'id, job_slug, job_role, full_name, email, phone, applicant_role, portfolio_link, why, start_date, onsite_ok, status, created_at, resume';

type Row = {
	id: string;
	job_slug: string;
	job_role: string;
	full_name: string;
	email: string;
	phone: string;
	applicant_role: string;
	portfolio_link: string;
	why: string;
	start_date: string | null;
	onsite_ok: boolean;
	status: ApplicantStatus;
	created_at: string;
	resume: { path?: string; name?: string } | null;
};

function toApplicant(row: Row): CompanyApplicant {
	return {
		id: row.id,
		jobSlug: row.job_slug,
		jobRole: row.job_role,
		fullName: row.full_name,
		email: row.email,
		phone: row.phone,
		applicantRole: row.applicant_role,
		portfolioLink: row.portfolio_link,
		why: row.why,
		startDate: row.start_date,
		onsiteOk: row.onsite_ok,
		status: row.status,
		createdAt: row.created_at,
		resumePath: row.resume?.path ?? null,
		resumeName: row.resume?.name ?? 'resume'
	};
}

/**
 * Every applicant to a role this company posted, newest first.
 *
 * The company id is not passed in — the policy compares company_id against
 * auth.uid() itself, so a caller cannot ask for somebody else's applicants by
 * supplying a different id.
 */
export async function getMyApplicants(): Promise<CompanyApplicant[]> {
	const { data, error } = await supabase
		.from('job_applications')
		.select(COLUMNS)
		.order('created_at', { ascending: false });

	if (error || !data) return [];
	return (data as Row[]).map(toApplicant);
}

const SIGNED_URL_SECONDS = 600;

/**
 * A short-lived link to one resume. The bucket is private; the storage policy
 * lets a verified company sign an object whose folder is one of its own job
 * slugs, and nothing else.
 */
export async function resumeUrl(path: string): Promise<string | null> {
	const { data, error } = await supabase.storage
		.from('job-applications')
		.createSignedUrl(path, SIGNED_URL_SECONDS);

	if (error || !data) return null;
	return data.signedUrl;
}

