import { error, json } from '@sveltejs/kit';
import { logFounderAction, requireFounder } from '$lib/server/founderGuard';
import type { RequestHandler } from './$types';

// Job postings, written on the server rather than straight from the browser.
//
// A founder used to insert into public.jobs with their own session, which was
// fine while "verified company" was the only gate. It no longer is: a posting
// now carries an approval state that its author must not be able to set, and
// that state is easier to keep honest in one place than in a column grant the
// browser can try its luck against.
//
// The queue itself is what tells TIC there is something to look at: it surfaces
// on /tic-admin/approvals and in the overview counts. No mail is sent from here.
//
// POST   { job }        create, queued for approval
// PATCH  { id, job }    edit; the trigger sends it back to the queue
// DELETE ?id=           withdraw a posting

type JobInput = {
	role?: string;
	company?: string;
	location?: string;
	type?: string;
	sector?: string;
	description?: string;
	applyLink?: string;
};

function isSafeApplyLink(value: string): boolean {
	const v = value.trim().toLowerCase();
	return v.startsWith('https://') || v.startsWith('http://') || v.startsWith('mailto:');
}

function clean(
	input: JobInput
): { ok: true; row: Record<string, string> } | { ok: false; error: string } {
	const role = (input.role ?? '').trim();
	const company = (input.company ?? '').trim();
	const description = (input.description ?? '').trim();
	const applyLink = (input.applyLink ?? '').trim();

	if (!role || !company || !description) {
		return { ok: false, error: 'Role, company and description are required.' };
	}
	if (!isSafeApplyLink(applyLink)) {
		return { ok: false, error: 'Apply link must start with https://, http:// or mailto:.' };
	}

	return {
		ok: true,
		row: {
			role,
			company,
			location: (input.location ?? '').trim(),
			type: input.type === 'Internship' ? 'Internship' : 'Full-time',
			sector: (input.sector ?? '').trim(),
			description,
			apply_link: applyLink
		}
	};
}

export const POST: RequestHandler = async ({ cookies, request }) => {
	const ctx = requireFounder(cookies);
	const body = (await request.json().catch(() => ({}))) as JobInput;

	const parsed = clean(body);
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
			company_id: ctx.companyId,
			company_slug: (company?.company_slug as string) || 'company',
			status: 'pending'
		})
		.select('id, role, slug, status')
		.single();

	if (dbError) error(500, dbError.message);

	await logFounderAction(ctx, `submitted the role "${parsed.row.role}" for approval`, {
		table: 'jobs',
		recordId: data.id as string,
		after: parsed.row
	});
	return json({ ok: true, job: data });
};

export const PATCH: RequestHandler = async ({ cookies, request }) => {
	const ctx = requireFounder(cookies);
	const body = (await request.json().catch(() => ({}))) as JobInput & { id?: string };
	if (!body.id) error(400, 'Missing job id.');

	const parsed = clean(body);
	if (!parsed.ok) return json({ ok: false, error: parsed.error }, { status: 400 });

	// The company filter is the whole boundary here — the service key would
	// otherwise happily edit another startup's posting.
	// Queued explicitly rather than left to the database trigger: this route holds
	// the service key, and the trigger exempts the service role so that an admin
	// approving a posting — or renaming a company across every posting — does not
	// read as a founder's edit.
	const { data, error: dbError } = await ctx.db
		.from('jobs')
		.update({
			...parsed.row,
			status: 'pending',
			review_note: null,
			reviewed_at: null,
			reviewed_by: null,
			submitted_at: new Date().toISOString()
		})
		.eq('id', body.id)
		.eq('company_id', ctx.companyId)
		.select('id, role, slug, status')
		.maybeSingle();

	if (dbError) error(500, dbError.message);
	if (!data) return json({ ok: false, error: 'Role not found.' }, { status: 404 });

	await logFounderAction(
		ctx,
		`edited the role "${parsed.row.role}", sending it back for approval`,
		{
			table: 'jobs',
			recordId: body.id,
			after: parsed.row
		}
	);
	return json({ ok: true, job: data });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = requireFounder(cookies);
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

	await logFounderAction(ctx, `withdrew the role "${data.role as string}"`, {
		table: 'jobs',
		recordId: id
	});
	return json({ ok: true });
};
