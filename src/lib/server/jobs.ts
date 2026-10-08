import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import {
	PUBLIC_JOB_COLUMNS,
	today,
	toPublicJob,
	type JobOwner,
	type PublicJob,
	type PublicJobRow
} from '$lib/utils/jobPostings';

// The public side of the board. Read with the service key, so these filters are
// the whole rule and must match the "jobs: public read open" policy: open, not
// past its closing date, and — for a startup's role — a verified startup.

function openQuery() {
	const date = today();
	return supabaseAdmin
		.from('jobs')
		.select(`${PUBLIC_JOB_COLUMNS}, company_id, max_applicants, companies(status)`)
		.eq('status', 'open')
		.or(`closes_on.is.null,closes_on.gte.${date}`);
}

type Row = PublicJobRow & {
	company_id: string | null;
	max_applicants: number;
	companies: { status: string } | null;
};

function visible(row: Row): boolean {
	return row.owner === 'tic' || row.companies?.status === 'verified';
}

export async function listOpenJobs(owner: JobOwner): Promise<PublicJob[]> {
	const { data } = await openQuery().eq('owner', owner).order('posted', { ascending: false });
	return ((data ?? []) as unknown as Row[]).filter(visible).map(toPublicJob);
}

export async function getOpenJob(
	slug: string
): Promise<(PublicJob & { companyId: string | null; maxApplicants: number }) | null> {
	const { data } = await openQuery().eq('slug', slug).maybeSingle();
	const row = data as unknown as Row | null;
	if (!row || !visible(row)) return null;
	return { ...toPublicJob(row), companyId: row.company_id, maxApplicants: row.max_applicants };
}

export async function applicationCount(jobId: string): Promise<number> {
	const { count } = await supabaseAdmin
		.from('job_applications')
		.select('id', { count: 'exact', head: true })
		.eq('job_id', jobId);
	return count ?? 0;
}
