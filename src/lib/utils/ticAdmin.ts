// Data access for the TIC team admin screens. Every call goes through a
// service-role server route guarded by the admin session cookie, because the
// admin is not a Supabase Auth user and so cannot satisfy RLS directly.

import type { CompanyStatus } from '$lib/utils/companies';
import type { AccountRole } from '$lib/utils/roles';

export async function adminSetCompanyStatus(
	id: string,
	status: CompanyStatus,
	rejectionReason?: string
): Promise<boolean> {
	const res = await fetch('/api/tic-admin/companies', {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ id, status, rejectionReason })
	});
	return res.ok;
}

export async function adminDeleteCompany(id: string): Promise<boolean> {
	const res = await fetch(`/api/tic-admin/companies?id=${encodeURIComponent(id)}`, {
		method: 'DELETE'
	});
	return res.ok;
}

export async function adminDeleteJob(id: string): Promise<boolean> {
	const res = await fetch(`/api/tic-admin/jobs?id=${encodeURIComponent(id)}`, {
		method: 'DELETE'
	});
	return res.ok;
}

// --- applications ----------------------------------------------------------

export type ApplicationStatus = 'submitted' | 'under-review' | 'accepted' | 'rejected';

export type ApplicationSummary = {
	id: string;
	user_id: string;
	status: ApplicationStatus;
	full_name: string;
	email: string;
	startup_name: string;
	// The applicant-facing line (emailed + shown on their account) and the team's
	// private note. Only the console (service role) can read review_note.
	applicant_message: string | null;
	review_note: string | null;
	reviewed_at: string | null;
	created_at: string;
	updated_at: string;
};

export type ApplicationDetail = ApplicationSummary & {
	answers: Record<string, unknown>;
	documents: Record<string, { path: string; name: string; size: number }>;
};

export type DocumentLink = { name: string; size: number; url: string | null };

export async function adminSetApplicationStatus(
	id: string,
	status: ApplicationStatus,
	applicantMessage?: string,
	reviewNote?: string
): Promise<boolean> {
	const res = await fetch('/api/tic-admin/applications', {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ id, status, applicantMessage, reviewNote })
	});
	return res.ok;
}

export async function adminDeleteApplication(id: string): Promise<boolean> {
	const res = await fetch(`/api/tic-admin/applications?id=${encodeURIComponent(id)}`, {
		method: 'DELETE'
	});
	return res.ok;
}

// --- role applications -----------------------------------------------------

export type JobApplicationStatus = 'new' | 'shortlisted' | 'forwarded' | 'rejected';

export type JobApplicationSummary = {
	id: string;
	job_slug: string;
	job_role: string;
	job_company: string;
	job_source: 'seed' | 'user';
	company_id: string | null;
	full_name: string;
	email: string;
	applicant_role: string;
	status: JobApplicationStatus;
	review_note: string | null;
	reviewed_at: string | null;
	created_at: string;
};

export type JobApplicationDetail = JobApplicationSummary & {
	job_id: string | null;
	phone: string;
	portfolio_link: string;
	why: string;
	start_date: string | null;
	onsite_ok: boolean;
	consent: boolean;
	resume: { path?: string; name?: string; size?: number; type?: string };
	updated_at: string;
};

export async function adminSetJobApplicationStatus(
	id: string,
	status: JobApplicationStatus,
	reviewNote?: string
): Promise<boolean> {
	const res = await fetch('/api/tic-admin/job-applications', {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ id, status, reviewNote })
	});
	return res.ok;
}

export async function adminDeleteJobApplication(id: string): Promise<boolean> {
	const res = await fetch(`/api/tic-admin/job-applications?id=${encodeURIComponent(id)}`, {
		method: 'DELETE'
	});
	return res.ok;
}

export type JobApplicationExportRow = JobApplicationSummary & {
	phone: string;
	portfolio_link: string;
	why: string;
	start_date: string | null;
	onsite_ok: boolean;
};

// The full records behind the table, for the CSV. Fetched on demand rather than
// carried in the page data: the export is occasional, the list view is not.
export async function adminExportJobApplications(
	jobSlug?: string
): Promise<JobApplicationExportRow[]> {
	const query = jobSlug ? `?jobSlug=${encodeURIComponent(jobSlug)}` : '';
	const res = await fetch(`/api/tic-admin/job-applications${query}`);
	if (!res.ok) return [];

	const body = (await res.json().catch(() => ({}))) as { applicants?: JobApplicationExportRow[] };
	return body.applicants ?? [];
}

/**
 * Deletes every applicant for one role, resumes included. Returns how many went,
 * or null if the purge failed.
 */
export async function adminClearJobApplicants(jobSlug: string): Promise<number | null> {
	const res = await fetch(
		`/api/tic-admin/job-applications?jobSlug=${encodeURIComponent(jobSlug)}`,
		{ method: 'POST' }
	);
	if (!res.ok) return null;

	const body = (await res.json().catch(() => ({}))) as { deleted?: number };
	return body.deleted ?? 0;
}

export async function adminLiftSuppression(email: string): Promise<boolean> {
	const res = await fetch(`/api/tic-admin/email/suppressions?email=${encodeURIComponent(email)}`, {
		method: 'DELETE'
	});
	return res.ok;
}

export type NewsletterSubscriber = {
	id: string;
	email: string;
	source: string;
	created_at: string;
};

export async function adminListNewsletter(): Promise<NewsletterSubscriber[]> {
	const res = await fetch('/api/tic-admin/newsletter');
	if (!res.ok) return [];
	const body = (await res.json().catch(() => ({}))) as { subscribers?: NewsletterSubscriber[] };
	return body.subscribers ?? [];
}

// --- users -----------------------------------------------------------------

// A founder, or one of the TIC staff roles in $lib/utils/roles. 'company' is
// gone: an account is a person, and a company is something a founder creates —
// possibly several.
export type UserRole = AccountRole;

export type ManagedUser = {
	id: string;
	email: string;
	role: UserRole;
	fullName: string;
	phone: string;
	responsibility: string;
	department: string;
	createdAt: string;
	lastSignInAt: string | null;
	emailConfirmed: boolean;
	banned: boolean;
	/** The startups this person created. A founder may run several. */
	companies: { name: string; status: string }[];
};

async function readError(res: Response): Promise<string> {
	const body = (await res.json().catch(() => ({}))) as { message?: string };
	return body.message ?? 'Something went wrong.';
}

export async function adminSetUserRole(
	id: string,
	role: UserRole
): Promise<{ ok: true } | { ok: false; error: string }> {
	const res = await fetch('/api/tic-admin/users', {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ id, role })
	});
	return res.ok ? { ok: true } : { ok: false, error: await readError(res) };
}

export async function adminSetUserBanned(
	id: string,
	banned: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
	const res = await fetch('/api/tic-admin/users', {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ id, banned })
	});
	return res.ok ? { ok: true } : { ok: false, error: await readError(res) };
}

export async function adminSendPasswordReset(
	id: string,
	email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	const res = await fetch('/api/tic-admin/users', {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ id, email })
	});
	return res.ok ? { ok: true } : { ok: false, error: await readError(res) };
}

export async function adminDeleteUser(
	id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	const res = await fetch(`/api/tic-admin/users?id=${encodeURIComponent(id)}`, {
		method: 'DELETE'
	});
	return res.ok ? { ok: true } : { ok: false, error: await readError(res) };
}

export async function adminCreateAdmin(input: {
	email: string;
	password: string;
	fullName: string;
	role?: UserRole;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const res = await fetch('/api/tic-admin/users', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.ok ? { ok: true } : { ok: false, error: await readError(res) };
}

// --- activity --------------------------------------------------------------

export type AuditEntry = {
	id: number;
	occurred_at: string;
	source: 'trigger' | 'app';
	actor_id: string | null;
	actor_label: string;
	action: string;
	table_name: string | null;
	record_id: string | null;
	before: Record<string, unknown> | null;
	after: Record<string, unknown> | null;
};

export type PageViewEntry = {
	id: number;
	occurred_at: string;
	path: string;
	visitor_id: string;
	actor_label: string | null;
	is_admin: boolean;
	referrer: string | null;
	status: number | null;
	duration_ms: number | null;
};

export type Impression = {
	path: string;
	total: number;
	visitors: number;
	bots: number;
	admin_views: number;
	is_admin: boolean;
	last_seen: string;
	/** Distinct human visitors across the whole window, repeated on every row.
	 *  Summing the per-path `visitors` counts one person once per page they
	 *  opened, so the site-wide figure has to come from the query itself. */
	site_visitors: number;
};

export async function adminListAudit(
	options: { table?: string; before?: number } = {}
): Promise<AuditEntry[]> {
	const params = new URLSearchParams({ view: 'audit' });
	if (options.table && options.table !== 'all') params.set('table', options.table);
	if (options.before) params.set('before', String(options.before));

	const res = await fetch(`/api/tic-admin/activity?${params}`);
	if (!res.ok) return [];
	return ((await res.json()) as { entries: AuditEntry[] }).entries ?? [];
}

// One numbered page of the audit log and its total, for the pagination bar.
export async function adminAuditPage(
	table: string,
	page: number,
	size: number
): Promise<{ rows: AuditEntry[]; total: number }> {
	const params = new URLSearchParams({ view: 'audit', page: String(page), size: String(size) });
	if (table && table !== 'all') params.set('table', table);
	const res = await fetch(`/api/tic-admin/activity?${params}`);
	if (!res.ok) return { rows: [], total: 0 };
	const body = (await res.json()) as { entries?: AuditEntry[]; total?: number | null };
	return { rows: body.entries ?? [], total: body.total ?? 0 };
}

// One page of recent visits and the total.
export async function adminVisitsPage(
	page: number,
	size: number
): Promise<{ rows: PageViewEntry[]; total: number }> {
	const params = new URLSearchParams({ view: 'visits', page: String(page), size: String(size) });
	const res = await fetch(`/api/tic-admin/activity?${params}`);
	if (!res.ok) return { rows: [], total: 0 };
	const body = (await res.json()) as { visits?: PageViewEntry[]; total?: number };
	return { rows: body.visits ?? [], total: body.total ?? 0 };
}

// Impressions for a window other than all-time. The initial all-time set comes
// from the page load, so this only runs when the range picker changes.
export async function adminGetImpressions(range: '7d' | '30d' | 'all'): Promise<Impression[]> {
	const res = await fetch(`/api/tic-admin/activity?view=impressions&range=${range}`);
	if (!res.ok) return [];
	return ((await res.json()) as { impressions: Impression[] }).impressions ?? [];
}

// --- email -----------------------------------------------------------------

import type { EmailBlock } from '$lib/utils/emailBlocks';

export type EmailStatus = 'sent' | 'failed' | 'blocked';

export type EmailLogEntry = {
	id: string;
	template_key: string;
	to_email: string;
	to_name: string;
	subject: string;
	status: EmailStatus;
	provider_id: string | null;
	error: string | null;
	is_test: boolean;
	context: Record<string, unknown>;
	created_at: string;
};

// The rendered body is only fetched when a message is actually opened — the log
// list would otherwise carry a few KB of HTML per row.
export type EmailMessage = {
	id: string;
	subject: string;
	body: string;
	to_email: string;
	to_name: string;
	status: EmailStatus;
	created_at: string;
};

export async function adminListEmailLog(
	options: { before?: string } = {}
): Promise<EmailLogEntry[]> {
	const params = new URLSearchParams();
	if (options.before) params.set('before', options.before);

	const res = await fetch(`/api/tic-admin/email?${params}`);
	if (!res.ok) return [];
	return ((await res.json()) as { entries: EmailLogEntry[] }).entries ?? [];
}

// One page of the delivery log, filtered on the server, with the tab counts.
export async function adminEmailLogPage(options: {
	status: string;
	tests: boolean;
	page: number;
	size: number;
}): Promise<{
	rows: EmailLogEntry[];
	total: number;
	counts: { all: number; sent: number; failed: number; blocked: number };
	testSends: number;
}> {
	const params = new URLSearchParams({
		page: String(options.page),
		size: String(options.size),
		status: options.status,
		tests: options.tests ? '1' : '0'
	});
	const res = await fetch(`/api/tic-admin/email?${params}`);
	if (!res.ok) {
		return { rows: [], total: 0, counts: { all: 0, sent: 0, failed: 0, blocked: 0 }, testSends: 0 };
	}
	return res.json();
}

export async function adminGetEmailMessage(id: string): Promise<EmailMessage | null> {
	const res = await fetch(`/api/tic-admin/email?id=${encodeURIComponent(id)}`);
	if (!res.ok) return null;
	return ((await res.json()) as { message: EmailMessage }).message ?? null;
}

// `blocks` is the composed version; the server compiles the body from it. Pass
// `body` instead only when the template is being hand-edited as HTML.
export async function adminSaveEmailTemplate(input: {
	key: string;
	subject: string;
	enabled: boolean;
	blocks?: EmailBlock[];
	body?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const res = await fetch('/api/tic-admin/email', {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(input)
	});
	return res.ok ? { ok: true } : { ok: false, error: await readError(res) };
}

export async function adminResetEmailTemplate(
	key: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	const res = await fetch(`/api/tic-admin/email?key=${encodeURIComponent(key)}`, {
		method: 'DELETE'
	});
	return res.ok ? { ok: true } : { ok: false, error: await readError(res) };
}

export async function adminSendTestEmail(
	key: string,
	to?: string
): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
	const res = await fetch('/api/tic-admin/email', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ key, to })
	});
	if (!res.ok) return { ok: false, error: await readError(res) };
	return { ok: true, to: ((await res.json()) as { to: string }).to };
}

export type UploadedAsset = { url: string; name: string; size: string };

// Pictures and documents for the image and file blocks. Uploaded one at a time
// from the editor, straight into the public email-assets bucket.
export async function adminUploadEmailAsset(
	file: File
): Promise<{ ok: true; asset: UploadedAsset } | { ok: false; error: string }> {
	const form = new FormData();
	form.set('file', file);

	const res = await fetch('/api/tic-admin/email/assets', { method: 'POST', body: form });
	if (!res.ok) return { ok: false, error: await readError(res) };
	return { ok: true, asset: (await res.json()) as UploadedAsset };
}
