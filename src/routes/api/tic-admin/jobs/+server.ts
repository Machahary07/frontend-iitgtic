import { error, json } from '@sveltejs/kit';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import { sendTemplateEmail } from '$lib/server/email';
import { applicationCount } from '$lib/server/jobs';
import { cleanJob, type JobFields } from '$lib/utils/jobPostings';
import type { RequestHandler } from './$types';

// Job postings from the TIC side.
//
// TIC's own roles (owner 'tic'): create, edit, close, reopen, delete.
// A startup's roles (owner 'incubatee'): read-only, except that TIC can take one
// down with a reason. The founder reads the reason in their console and by email,
// and the role's applicants stay with the startup.
//
// POST   { ...fields }                          post a TIC role, live straight away
// PATCH  { id, ...fields }                      edit a TIC role
// PATCH  { id, action: close | reopen }         a TIC role
// PATCH  { id, action: remove, reason }         a startup's role
// DELETE ?id=                                   a TIC role

const TIC_COMPANY = 'IITG TIC';
const TIC_SLUG = 'iitg-tic';

type Body = Partial<JobFields> & {
	id?: string;
	action?: 'close' | 'reopen' | 'remove';
	reason?: string;
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);
	const body = (await request.json().catch(() => ({}))) as Body;

	const parsed = cleanJob(body, { requireCompany: false });
	if (!parsed.ok) return json({ ok: false, error: parsed.error }, { status: 400 });

	const { data, error: dbError } = await ctx.db
		.from('jobs')
		.insert({
			...parsed.row,
			owner: 'tic',
			company_id: null,
			company: TIC_COMPANY,
			company_slug: TIC_SLUG,
			status: 'open'
		})
		.select('id, slug')
		.single();
	if (dbError) error(500, dbError.message);

	await logAdminAction(ctx, `posted the TIC role "${parsed.row.role}"`, {
		table: 'jobs',
		recordId: data.id as string
	});
	return json({ ok: true, job: data });
};

export const PATCH: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);
	const body = (await request.json().catch(() => ({}))) as Body;
	if (!body.id) error(400, 'Missing job id.');

	const { data: job } = await ctx.db
		.from('jobs')
		.select('id, owner, role, company, company_id, status, max_applicants')
		.eq('id', body.id)
		.maybeSingle();
	if (!job) return json({ ok: false, error: 'Role not found.' }, { status: 404 });

	if (body.action === 'remove') {
		if (job.owner !== 'incubatee') error(400, 'Delete a TIC role instead.');
		const reason = body.reason?.trim();
		if (!reason) return json({ ok: false, error: 'Write a reason.' }, { status: 400 });

		const { error: dbError } = await ctx.db
			.from('jobs')
			.update({
				status: 'removed',
				removed_reason: reason,
				removed_at: new Date().toISOString(),
				removed_by: ctx.admin.userId
			})
			.eq('id', body.id);
		if (dbError) error(500, dbError.message);

		const { data: company } = await ctx.db
			.from('companies')
			.select('company_name, contact_name, contact_email, email')
			.eq('id', job.company_id as string)
			.maybeSingle();
		const to = (company?.contact_email as string) || (company?.email as string) || '';
		if (to) {
			await sendTemplateEmail({
				templateKey: 'role-removed',
				to,
				toName: (company?.contact_name as string) ?? '',
				variables: {
					contactName: (company?.contact_name as string) ?? '',
					role: job.role as string,
					companyName: (company?.company_name as string) || (job.company as string),
					reason
				},
				context: { table: 'jobs', recordId: body.id, status: 'removed' },
				sentBy: ctx.admin.userId
			});
		}

		await logAdminAction(
			ctx,
			`removed the role "${job.role as string}" from ${job.company as string}`,
			{
				table: 'jobs',
				recordId: body.id,
				after: { status: 'removed', reason }
			}
		);
		return json({ ok: true });
	}

	// Everything below is TIC's own roles only.
	if (job.owner !== 'tic') error(403, 'A startup’s role can only be removed.');

	if (body.action === 'close' || body.action === 'reopen') {
		const status = body.action === 'close' ? 'closed' : 'open';
		if (status === 'open' && (await applicationCount(body.id)) >= (job.max_applicants as number)) {
			return json(
				{ ok: false, error: 'This role has reached its application limit, so it stays closed.' },
				{ status: 409 }
			);
		}
		// closed_at starts the 90-day resume clock; reopening stops it.
		const { error: dbError } = await ctx.db
			.from('jobs')
			.update({
				status,
				closed_at: status === 'closed' ? new Date().toISOString() : null,
				resumes_warned_at: null
			})
			.eq('id', body.id);
		if (dbError) error(500, dbError.message);
		await logAdminAction(
			ctx,
			`${body.action === 'close' ? 'closed' : 'reopened'} the TIC role "${job.role as string}"`,
			{ table: 'jobs', recordId: body.id, after: { status } }
		);
		return json({ ok: true });
	}

	const parsed = cleanJob(body, { requireCompany: false });
	if (!parsed.ok) return json({ ok: false, error: parsed.error }, { status: 400 });

	const { error: dbError } = await ctx.db.from('jobs').update(parsed.row).eq('id', body.id);
	if (dbError) error(500, dbError.message);

	await logAdminAction(ctx, `edited the TIC role "${parsed.row.role}"`, {
		table: 'jobs',
		recordId: body.id
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireAdmin(cookies);
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing job id.');

	const { data, error: dbError } = await ctx.db
		.from('jobs')
		.delete()
		.eq('id', id)
		.eq('owner', 'tic')
		.select('role')
		.maybeSingle();
	if (dbError) error(500, dbError.message);
	if (!data) return json({ ok: false, error: 'Role not found.' }, { status: 404 });

	await logAdminAction(ctx, `deleted the TIC role "${data.role as string}"`, {
		table: 'jobs',
		recordId: id
	});
	return json({ ok: true });
};
