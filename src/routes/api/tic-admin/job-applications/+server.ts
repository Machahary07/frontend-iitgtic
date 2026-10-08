import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import { signResumes } from '$lib/server/resumes';
import type { RequestHandler } from './$types';

// Applicants to TIC's own roles, received and read — there are no stages. A
// startup's applicants are the startup's alone, so every query here is held to
// rows with no company: TIC cannot read or delete someone who applied to a
// startup.

const BUCKET = 'job-applications';

// Full rows for the CSV export. The page loader deliberately selects a summary —
// it renders a table, and shipping every applicant's resume path and free-text
// answer into the HTML of a list view is a waste at best. An export needs the
// whole record, so it asks for it here instead.
export const GET: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireAdmin(cookies);
	const jobSlug = url.searchParams.get('jobSlug');

	// ?resumes=1: ten-minute links to every resume in view, zipped in the browser.
	if (url.searchParams.get('resumes')) {
		let rows = ctx.db.from('job_applications').select('full_name, resume').is('company_id', null);
		if (jobSlug) rows = rows.eq('job_slug', jobSlug);
		const { data, error: readError } = await rows;
		if (readError) error(500, readError.message);
		const files = await signResumes(data ?? []);
		await logAdminAction(ctx, `downloaded resumes${jobSlug ? ` for ${jobSlug}` : ''}`, {
			table: 'job_applications'
		});
		return json({ files });
	}

	let query = ctx.db
		.from('job_applications')
		.select(
			'id, job_slug, job_role, job_company, job_source, full_name, email, phone, applicant_role, portfolio_link, why, start_date, onsite_ok, created_at'
		)
		.is('company_id', null)
		.order('created_at', { ascending: false });

	if (jobSlug) query = query.eq('job_slug', jobSlug);

	const { data, error: dbError } = await query;
	if (dbError) error(500, dbError.message);

	await logAdminAction(ctx, `exported applicants${jobSlug ? ` for ${jobSlug}` : ''}`, {
		table: 'job_applications'
	});

	return json({ applicants: data ?? [] });
};

// Retention, done by hand. There is no scheduled purge: resumes are people's
// personal documents, and deleting them on a timer is the kind of thing that is
// only noticed once it has already run. Clearing a closed role is a decision
// somebody makes, and it is audited like every other admin action.
export const POST: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireAdmin(cookies);
	const jobSlug = url.searchParams.get('jobSlug');
	if (!jobSlug) error(400, 'Missing job slug.');

	const { data: rows, error: readError } = await ctx.db
		.from('job_applications')
		.select('id, resume')
		.eq('job_slug', jobSlug)
		.is('company_id', null);
	if (readError) error(500, readError.message);
	if (!rows || rows.length === 0) return json({ ok: true, deleted: 0 });

	// Files first: once the rows are gone nothing records where the objects are.
	const paths = rows
		.map((row) => (row.resume as { path?: string } | null)?.path)
		.filter((path): path is string => Boolean(path));

	if (paths.length > 0) {
		const { error: storageError } = await supabaseAdmin.storage.from(BUCKET).remove(paths);
		if (storageError) error(500, `Could not remove the resumes: ${storageError.message}`);
	}

	await logAdminAction(ctx, `cleared ${rows.length} applicant(s) for ${jobSlug}`, {
		table: 'job_applications'
	});

	const { error: dbError } = await ctx.db
		.from('job_applications')
		.delete()
		.eq('job_slug', jobSlug)
		.is('company_id', null);
	if (dbError) error(500, dbError.message);

	return json({ ok: true, deleted: rows.length });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireAdmin(cookies);
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing application id.');

	// The resume is only reachable through this row, so it goes first — deleting
	// the row on its own would orphan the object in the bucket.
	const { data: row } = await ctx.db
		.from('job_applications')
		.select('resume')
		.eq('id', id)
		.is('company_id', null)
		.maybeSingle();
	if (!row) error(404, 'Application not found.');

	const path = (row?.resume as { path?: string } | null)?.path;
	if (path) await supabaseAdmin.storage.from(BUCKET).remove([path]);

	await logAdminAction(ctx, 'deleted a role applicant', {
		table: 'job_applications',
		recordId: id
	});

	const { error: dbError } = await ctx.db
		.from('job_applications')
		.delete()
		.eq('id', id)
		.is('company_id', null);
	if (dbError) error(500, dbError.message);

	return json({ ok: true });
};
