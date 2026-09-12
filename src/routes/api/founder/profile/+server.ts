import { error, json } from '@sveltejs/kit';
import { logFounderAction, requireCompanyOwner } from '$lib/server/founderGuard';
import type { RequestHandler } from './$types';

// A company's name, website and contact details sit next to every role it posts,
// so changing them changes public copy. The founder writes into this queue
// instead of into public.companies — the grant was revoked for exactly that
// reason — and a TIC admin's verdict is what applies it.
//
// POST    { companyId, changes }  ask for a change
// DELETE  ?companyId=&id=         take a pending request back

const FIELDS = ['companyName', 'website', 'contactName', 'contactEmail', 'phone'] as const;
type Field = (typeof FIELDS)[number];

export const POST: RequestHandler = async ({ cookies, request }) => {
	const body = (await request.json().catch(() => ({}))) as Partial<Record<Field, string>> & {
		companyId?: string;
	};
	const ctx = await requireCompanyOwner(cookies, body.companyId);

	const { data: current } = await ctx.db
		.from('companies')
		.select('company_name, website, contact_name, contact_email, phone')
		.eq('id', ctx.companyId)
		.maybeSingle();
	if (!current) error(404, 'Company not found.');

	const now: Record<Field, string> = {
		companyName: (current.company_name as string) ?? '',
		website: (current.website as string) ?? '',
		contactName: (current.contact_name as string) ?? '',
		contactEmail: (current.contact_email as string) ?? '',
		phone: (current.phone as string) ?? ''
	};

	// Only what actually differs is queued, so an admin reads a change rather
	// than a re-statement of the whole record.
	const changes: Record<string, { from: string; to: string }> = {};
	for (const field of FIELDS) {
		const value = body[field]?.trim();
		if (value === undefined) continue;
		if (value === now[field]) continue;
		changes[field] = { from: now[field], to: value };
	}

	if (!changes.companyName && Object.keys(changes).length === 0) {
		return json({ ok: false, error: 'Nothing changed.' }, { status: 400 });
	}
	if (changes.companyName && !changes.companyName.to) {
		return json({ ok: false, error: 'Company name cannot be empty.' }, { status: 400 });
	}

	// One pending request at a time: a second would leave an admin guessing which
	// of two overlapping edits is the real one.
	await ctx.db
		.from('company_profile_changes')
		.update({ status: 'rejected', review_note: 'Replaced by a newer request.' })
		.eq('company_id', ctx.companyId)
		.eq('status', 'pending');

	const { data, error: dbError } = await ctx.db
		.from('company_profile_changes')
		.insert({
			company_id: ctx.companyId,
			requested_by: ctx.founder.userId,
			status: 'pending',
			changes
		})
		.select('id')
		.single();

	if (dbError) error(500, dbError.message);

	await logFounderAction(ctx, 'asked TIC to approve a change to the company details', {
		table: 'company_profile_changes',
		recordId: data.id as string,
		after: changes
	});

	return json({ ok: true, id: data.id });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireCompanyOwner(cookies, url.searchParams.get('companyId'));
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing request id.');

	const { data, error: dbError } = await ctx.db
		.from('company_profile_changes')
		.delete()
		.eq('id', id)
		.eq('company_id', ctx.companyId)
		.eq('status', 'pending')
		.select('id')
		.maybeSingle();

	if (dbError) error(500, dbError.message);
	if (!data) return json({ ok: false, error: 'Request not found.' }, { status: 404 });

	await logFounderAction(ctx, 'withdrew a company details change request', {
		table: 'company_profile_changes',
		recordId: id
	});
	return json({ ok: true });
};
