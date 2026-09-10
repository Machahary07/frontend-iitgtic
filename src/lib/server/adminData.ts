import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { AdminSession } from '$lib/server/ticAdminSession';

// Read helpers shared by the admin load functions. Mutations still go through
// /api/tic-admin/* so they can be attributed and audited; these are the reads
// that populate a page on first paint.

export function adminDb(admin: AdminSession): SupabaseClient {
	return createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
		global: { headers: { 'x-actor-id': admin.userId } }
	});
}

const COMPANY_COLUMNS =
	'id, email, company_name, company_slug, website, contact_name, status, rejection_reason, created_at';

export type CompanyRow = {
	id: string;
	email: string;
	company_name: string;
	company_slug: string;
	website: string;
	contact_name: string;
	status: 'pending' | 'verified' | 'rejected';
	rejection_reason: string | null;
	created_at: string;
};

export function toAccount(row: CompanyRow) {
	return {
		id: row.id,
		email: row.email,
		companyName: row.company_name,
		companySlug: row.company_slug,
		website: row.website,
		contactName: row.contact_name,
		status: row.status,
		rejectionReason: row.rejection_reason ?? undefined,
		createdAt: row.created_at
	};
}

export async function loadCompanies(db: SupabaseClient) {
	const { data } = await db
		.from('companies')
		.select(COMPANY_COLUMNS)
		.order('created_at', { ascending: false });
	return ((data ?? []) as CompanyRow[]).map(toAccount);
}

export async function loadJobs(db: SupabaseClient) {
	const { data } = await db
		.from('jobs')
		.select(
			'id, company_id, slug, role, company, company_slug, location, type, sector, posted, description, apply_link, created_at, updated_at'
		)
		.order('posted', { ascending: false });
	return data ?? [];
}

export async function loadJobApplications(db: SupabaseClient) {
	const { data } = await db
		.from('job_applications')
		.select(
			'id, job_slug, job_role, job_company, job_source, company_id, full_name, email, applicant_role, status, review_note, reviewed_at, created_at'
		)
		.order('created_at', { ascending: false });
	return data ?? [];
}

export async function loadApplications(db: SupabaseClient) {
	const { data } = await db
		.from('applications')
		.select(
			'id, user_id, status, full_name, email, startup_name, applicant_message, review_note, reviewed_at, created_at, updated_at'
		)
		.order('created_at', { ascending: false });
	return data ?? [];
}
