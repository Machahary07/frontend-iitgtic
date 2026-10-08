import { error, json } from '@sveltejs/kit';
import { logFounderAction, requireFounder } from '$lib/server/founderGuard';
import { applicationCount } from '$lib/server/jobs';
import { cleanJob, type JobFields } from '$lib/utils/jobPostings';
import type { RequestHandler } from './$types';

// A startup's job postings. A role goes live the moment it is saved — the
// startup is already verified by TIC, so there is nothing left to approve. TIC
// can still take a role down with a reason (/api/tic-admin/jobs), and a removed
// role is TIC's: the founder can read why, or delete it, but not edit or reopen it.
//
// Every call names the company it is for, and requireFounder checks that against
// the caller's own — a founder with three startups must not be able to post a
// role for someone else's by changing one field.
//
// POST   { companyId, ...fields }                 create, live straight away
// PATCH  { companyId, id, ...fields }             edit
// PATCH  { companyId, id, action: close|reopen }  stop or restart applications
// DELETE ?companyId=&id=                          delete the role

type Body = Partial<JobFields> & {
	companyId?: string;
	id?: string;
	action?: 'close' | 'reopen';
};

function mustBeVerified(status: string) {
	if (status !== 'verified') error(403, 'TIC has not verified this startup yet.');
}

export const POST: RequestHandler = async ({ cookies, request }) => {
	const body = (await request.json().catch(() => ({}))) as Body;
	const ctx = await requireFounder(cookies, body.companyId);
	mustBeVerified(ctx.company.status);

	const parsed = cleanJob(body, { requireCompany: true });
	if (!parsed.ok) return json({ ok: false, error: parsed.error }, { status: 400 });

	const { data: company } = await ctx.db
		.from('companies')
		.select('company_slug')
		.eq('id', ctx.companyId)
		.maybeSingle();

	const { data, error: dbError } = await ctx.db
		.from('jobs')
		.insert({
			...parsed.row,
			owner: 'incubatee',
			company_id: ctx.companyId,
			company_slug: (company?.company_slug as string) || 'company',
			status: 'open'
		})
		.select('id, role, slug')
		.single();
	if (dbError) error(500, dbError.message);

	await logFounderAction(ctx, `posted the role "${parsed.row.role}"`, {
		table: 'jobs',
		recordId: data.id as string,
		after: parsed.row
	});
	return json({ ok: true, job: data });
};

export const PATCH: RequestHandler = async ({ cookies, request }) => {
	const body = (await request.json().catch(() => ({}))) as Body;
	const ctx = await requireFounder(cookies, body.companyId);
	mustBeVerified(ctx.company.status);
	if (!body.id) error(400, 'Missing job id.');

	// The company filter is the whole boundary here — the service key would
	// otherwise happily edit another startup's posting.
	const { data: current } = await ctx.db
		.from('jobs')
		.select('id, role, status, max_applicants')
		.eq('id', body.id)
		.eq('company_id', ctx.companyId)
		.maybeSingle();
	if (!current) return json({ ok: false, error: 'Role not found.' }, { status: 404 });
	if (current.status === 'removed') {
		return json(
			{ ok: false, error: 'TIC removed this role, so it cannot be changed.' },
			{ status: 409 }
		);
	}

	if (body.action === 'close' || body.action === 'reopen') {
		const status = body.action === 'close' ? 'closed' : 'open';
		if (
			status === 'open' &&
			(await applicationCount(body.id)) >= (current.max_applicants as number)
		) {
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
		await logFounderAction(
			ctx,
			`${body.action === 'close' ? 'closed' : 'reopened'} the role "${current.role as string}"`,
			{ table: 'jobs', recordId: body.id, after: { status } }
		);
		return json({ ok: true });
	}

	const parsed = cleanJob(body, { requireCompany: true });
	if (!parsed.ok) return json({ ok: false, error: parsed.error }, { status: 400 });

	const { error: dbError } = await ctx.db.from('jobs').update(parsed.row).eq('id', body.id);
	if (dbError) error(500, dbError.message);

	await logFounderAction(ctx, `edited the role "${parsed.row.role}"`, {
		table: 'jobs',
		recordId: body.id,
		after: parsed.row
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireFounder(cookies, url.searchParams.get('companyId'));
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing job id.');

	const { data, error: dbError } = await ctx.db
		.from('jobs')
		.delete()
		.eq('id', id)
		.eq('company_id', ctx.companyId)
		.select('role')
		.maybeSingle();

	if (dbError) error(500, dbError.message);
	if (!data) return json({ ok: false, error: 'Role not found.' }, { status: 404 });

	await logFounderAction(ctx, `deleted the role "${data.role as string}"`, {
		table: 'jobs',
		recordId: id
	});
	return json({ ok: true });
};
