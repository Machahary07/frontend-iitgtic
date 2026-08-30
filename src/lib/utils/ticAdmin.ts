// Data access for the TIC team admin screens. Every call goes through a
// service-role server route guarded by the admin session cookie, because the
// admin is not a Supabase Auth user and so cannot satisfy RLS directly.

import type { CompanyStatus } from '$lib/utils/companyAuth';

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
	reviewNote?: string
): Promise<boolean> {
	const res = await fetch('/api/tic-admin/applications', {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ id, status, reviewNote })
	});
	return res.ok;
}

export async function adminDeleteApplication(id: string): Promise<boolean> {
	const res = await fetch(`/api/tic-admin/applications?id=${encodeURIComponent(id)}`, {
		method: 'DELETE'
	});
	return res.ok;
}

// --- users -----------------------------------------------------------------

export type UserRole = 'founder' | 'company' | 'admin';

export type ManagedUser = {
	id: string;
	email: string;
	role: UserRole;
	fullName: string;
	phone: string;
	createdAt: string;
	lastSignInAt: string | null;
	emailConfirmed: boolean;
	banned: boolean;
	companyName: string | null;
	companyStatus: string | null;
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
};

export async function adminListAudit(options: { table?: string; before?: number } = {}): Promise<
	AuditEntry[]
> {
	const params = new URLSearchParams({ view: 'audit' });
	if (options.table && options.table !== 'all') params.set('table', options.table);
	if (options.before) params.set('before', String(options.before));

	const res = await fetch(`/api/tic-admin/activity?${params}`);
	if (!res.ok) return [];
	return ((await res.json()) as { entries: AuditEntry[] }).entries ?? [];
}

// Impressions for a window other than all-time. The initial all-time set comes
// from the page load, so this only runs when the range picker changes.
export async function adminGetImpressions(range: '7d' | '30d' | 'all'): Promise<Impression[]> {
	const res = await fetch(`/api/tic-admin/activity?view=impressions&range=${range}`);
	if (!res.ok) return [];
	return ((await res.json()) as { impressions: Impression[] }).impressions ?? [];
}
