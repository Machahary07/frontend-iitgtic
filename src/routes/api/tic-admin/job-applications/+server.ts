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
