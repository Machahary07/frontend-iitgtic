import { supabaseAdmin } from '$lib/server/supabaseAdmin';

const BUCKET = 'job-applications';
const LINK_SECONDS = 600;

type ResumeRow = { full_name: string; resume: { path?: string; name?: string } | null };

/** Ten-minute links for a batch of applicants' resumes, named after the person. */
export async function signResumes(rows: ResumeRow[]): Promise<{ url: string; name: string }[]> {
	const withFile = rows.filter((r) => r.resume?.path);
	if (withFile.length === 0) return [];

	const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(
		withFile.map((r) => r.resume!.path as string),
		LINK_SECONDS
	);
	return (data ?? [])
		.map((signed, i) => ({
			url: signed.signedUrl ?? '',
			name: `${withFile[i].full_name || 'applicant'}.pdf`
		}))
		.filter((f) => f.url !== '');
}

// --- retention --------------------------------------------------------------
// A role's resumes are deleted 90 days after it ends, so the bucket cannot grow
// without bound on TIC's bill. The poster is warned a week before and can
// download them all. Names and answers stay; only the files go.

const DAY = 86_400_000;
export const KEEP_DAYS = 90;
const WARN_DAYS = 7;

type EndedJob = {
	id: string;
	owner: 'tic' | 'incubatee';
	role: string;
	company_id: string | null;
	status: string;
	closes_on: string | null;
	closed_at: string | null;
	removed_at: string | null;
	resumes_warned_at: string | null;
};

/** When a role stopped taking applications, or null while it still is. */
export function endedAt(job: EndedJob, today: string): number | null {
	if (job.status === 'closed' && job.closed_at) return Date.parse(job.closed_at);
	if (job.status === 'removed' && job.removed_at) return Date.parse(job.removed_at);
	if (job.closes_on && job.closes_on < today) return Date.parse(`${job.closes_on}T23:59:59+05:30`);
	return null;
}

async function clearResumes(filter: { jobId?: string; orphanedBefore?: string }): Promise<number> {
	let query = supabaseAdmin.from('job_applications').select('id, resume');
	if (filter.jobId) query = query.eq('job_id', filter.jobId);
	else query = query.is('job_id', null).lt('created_at', filter.orphanedBefore as string);
	const { data } = await query;

	const rows = (data ?? []).filter((r) => (r.resume as { path?: string } | null)?.path);
	if (rows.length === 0) return 0;

	const paths = rows.map((r) => (r.resume as { path: string }).path);
	for (let i = 0; i < paths.length; i += 100) {
		await supabaseAdmin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
	}
	for (const row of rows) {
		const resume = row.resume as { name?: string; size?: number };
		await supabaseAdmin
			.from('job_applications')
			.update({ resume: { name: resume.name ?? 'resume.pdf', cleared: true } })
			.eq('id', row.id);
	}
	return rows.length;
}

export async function runResumeRetention(
	notify: (job: EndedJob, count: number, clearOn: Date) => Promise<void>
): Promise<{ warned: number; cleared: number }> {
	const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
	const now = Date.now();

	const { data } = await supabaseAdmin
		.from('jobs')
		.select(
			'id, owner, role, company_id, status, closes_on, closed_at, removed_at, resumes_warned_at'
		)
		.is('resumes_cleared_at', null)
		.or(`status.neq.open,closes_on.lt.${today}`);

	let warned = 0;
	let cleared = 0;
	for (const job of (data ?? []) as EndedJob[]) {
		const ended = endedAt(job, today);
		if (ended === null) continue;
		const clearOn = ended + KEEP_DAYS * DAY;

		if (now >= clearOn) {
			cleared += await clearResumes({ jobId: job.id });
			await supabaseAdmin
				.from('jobs')
				.update({ resumes_cleared_at: new Date().toISOString() })
				.eq('id', job.id);
		} else if (now >= clearOn - WARN_DAYS * DAY && !job.resumes_warned_at) {
			const { count } = await supabaseAdmin
				.from('job_applications')
				.select('id', { count: 'exact', head: true })
				.eq('job_id', job.id);
			if (count) {
				await notify(job, count, new Date(clearOn));
				warned += 1;
			}
			await supabaseAdmin
				.from('jobs')
				.update({ resumes_warned_at: new Date().toISOString() })
				.eq('id', job.id);
		}
	}

	// A deleted role leaves its applicants behind with no role to date them by,
	// so their resumes go 90 days after they applied.
	cleared += await clearResumes({
		orphanedBefore: new Date(now - KEEP_DAYS * DAY).toISOString()
	});

	return { warned, cleared };
}
