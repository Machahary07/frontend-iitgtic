import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import { sendTemplateEmail } from '$lib/server/email';
import type { RequestHandler } from './$types';

// Role applicants. public.job_applications has RLS on with no policies, so this
// service-role route is the only way the table is read back or moved along.

const STATUSES = ['new', 'shortlisted', 'forwarded', 'rejected'] as const;
type Status = (typeof STATUSES)[number];

const BUCKET = 'job-applications';

// 'new' is where an application starts, so moving one back to it is an internal
// correction and nothing is sent.
const TEMPLATE_FOR: Partial<Record<Status, string>> = {
	shortlisted: 'job-applicant-shortlisted',
	forwarded: 'job-applicant-forwarded',
	rejected: 'job-applicant-rejected'
};

export const PATCH: RequestHandler = async ({ cookies, request }) => {
	const ctx = requireAdmin(cookies);

	const body = (await request.json().catch(() => ({}))) as {
		id?: string;
		status?: string;
		reviewNote?: string;
	};
	if (!body.id) error(400, 'Missing application id.');
	if (!STATUSES.includes(body.status as Status)) error(400, 'Unknown status.');

	const { data: applicant, error: dbError } = await ctx.db
		.from('job_applications')
		.update({
			status: body.status,
			review_note: body.reviewNote?.trim() || null,
			reviewed_at: new Date().toISOString()
		})
		.eq('id', body.id)
		.select('email, full_name, job_role, job_company, review_note')
		.maybeSingle();
	if (dbError) error(500, dbError.message);

	await logAdminAction(ctx, `moved role applicant to ${body.status}`, {
		table: 'job_applications',
		recordId: body.id
	});

	// Applicants have no account to check, so the email is the only way they
	// learn where they stand. It cannot fail the request — sendTemplateEmail()
	// resolves either way and records what happened in email_log.
	const templateKey = TEMPLATE_FOR[body.status as Status];
	let email: { status: string; error: string | null } | null = null;

	if (templateKey && applicant?.email) {
		const result = await sendTemplateEmail({
			templateKey,
			to: applicant.email as string,
			toName: (applicant.full_name as string) ?? '',
			variables: {
				fullName: (applicant.full_name as string) ?? '',
				role: (applicant.job_role as string) ?? '',
				company: (applicant.job_company as string) ?? '',
				note: (applicant.review_note as string) ?? ''
			},
			context: { table: 'job_applications', recordId: body.id, status: body.status },
			sentBy: ctx.admin.userId
		});
		email = { status: result.status, error: result.error };
	}

	return json({ ok: true, email });
};

// Full rows for the CSV export. The page loader deliberately selects a summary —
// it renders a table, and shipping every applicant's resume path and free-text
// answer into the HTML of a list view is a waste at best. An export needs the
// whole record, so it asks for it here instead.
export const GET: RequestHandler = async ({ cookies, url }) => {
	const ctx = requireAdmin(cookies);
	const jobSlug = url.searchParams.get('jobSlug');

	let query = ctx.db
		.from('job_applications')
		.select(
			'id, job_slug, job_role, job_company, job_source, full_name, email, phone, applicant_role, portfolio_link, why, start_date, onsite_ok, status, review_note, reviewed_at, created_at'
		)
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
	const ctx = requireAdmin(cookies);
	const jobSlug = url.searchParams.get('jobSlug');
	if (!jobSlug) error(400, 'Missing job slug.');

	const { data: rows, error: readError } = await ctx.db
		.from('job_applications')
		.select('id, resume')
		.eq('job_slug', jobSlug);
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

	const { error: dbError } = await ctx.db.from('job_applications').delete().eq('job_slug', jobSlug);
	if (dbError) error(500, dbError.message);

	return json({ ok: true, deleted: rows.length });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = requireAdmin(cookies);
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing application id.');

	// The resume is only reachable through this row, so it goes first — deleting
	// the row on its own would orphan the object in the bucket.
	const { data: row } = await ctx.db
		.from('job_applications')
		.select('resume')
		.eq('id', id)
		.maybeSingle();

	const path = (row?.resume as { path?: string } | null)?.path;
	if (path) await supabaseAdmin.storage.from(BUCKET).remove([path]);

	await logAdminAction(ctx, 'deleted a role applicant', {
		table: 'job_applications',
		recordId: id
	});

	const { error: dbError } = await ctx.db.from('job_applications').delete().eq('id', id);
	if (dbError) error(500, dbError.message);

	return json({ ok: true });
};
