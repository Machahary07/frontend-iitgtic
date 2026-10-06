import { error, json } from '@sveltejs/kit';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import { sendTemplateEmail } from '$lib/server/email';
import type { RequestHandler } from './$types';

// The verdict side of the three founder queues. One route rather than three
// because the decision is the same shape every time — approve, or reject with a
// reason the founder will read — and because the approvals screen sends them all
// from one place.
//
// PATCH { kind: 'company' | 'job' | 'member' | 'profile', id, decision, note? }

type Body = {
	kind?: 'company' | 'job' | 'member' | 'profile';
	id?: string;
	decision?: 'approve' | 'reject';
	note?: string;
};

export const PATCH: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);
	const body = (await request.json().catch(() => ({}))) as Body;

	if (!body.id) error(400, 'Missing id.');
	if (body.decision !== 'approve' && body.decision !== 'reject') error(400, 'Missing decision.');

	const approved = body.decision === 'approve';
	const note = body.note?.trim() || null;

	// Companies are verified by accepting their incubation application, not here.
	if (body.kind === 'company') error(410, 'Companies are verified by accepting their application.');

	if (body.kind === 'job') {
		const { data, error: dbError } = await ctx.db
			.from('jobs')
			.update({
				status: approved ? 'approved' : 'rejected',
				review_note: note,
				reviewed_at: new Date().toISOString(),
				reviewed_by: ctx.admin.userId
			})
			.eq('id', body.id)
			.select('role, company, company_id')
			.maybeSingle();

		if (dbError) error(500, dbError.message);
		if (!data) error(404, 'Job not found.');

		// The founder hears the verdict by email as well as in their console.
		const { data: company } = await ctx.db
			.from('companies')
			.select('company_name, contact_name, contact_email, email')
			.eq('id', data.company_id as string)
			.maybeSingle();
		const to = (company?.contact_email as string) || (company?.email as string) || '';
		if (to) {
			await sendTemplateEmail({
				templateKey: 'role-decision',
				to,
				toName: (company?.contact_name as string) ?? '',
				variables: {
					contactName: (company?.contact_name as string) ?? '',
					role: data.role as string,
					companyName: (company?.company_name as string) || (data.company as string),
					approved: approved ? 'yes' : '',
					reason: approved ? '' : (note ?? '')
				},
				context: { table: 'jobs', recordId: body.id, status: approved ? 'approved' : 'rejected' },
				sentBy: ctx.admin.userId
			});
		}

		await logAdminAction(
			ctx,
			`${approved ? 'approved' : 'sent back'} the role "${data.role as string}" from ${data.company as string}`,
			{
				table: 'jobs',
				recordId: body.id,
				after: { status: approved ? 'approved' : 'rejected', note }
			}
		);
		return json({ ok: true });
	}

	if (body.kind === 'member') {
		const { data, error: dbError } = await ctx.db
			.from('profiles')
			.update({ member_status: approved ? 'approved' : 'rejected' })
			.eq('id', body.id)
			.eq('member_role', 'member')
			.select('full_name, email')
			.maybeSingle();

		if (dbError) error(500, dbError.message);
		if (!data) error(404, 'Member not found.');

		await logAdminAction(
			ctx,
			`${approved ? 'approved' : 'refused'} console access for ${(data.full_name as string) || (data.email as string)}`,
			{
				table: 'profiles',
				recordId: body.id,
				after: { member_status: approved ? 'approved' : 'rejected' }
			}
		);
		return json({ ok: true });
	}

	if (body.kind === 'profile') {
		const { data: request_, error: readError } = await ctx.db
			.from('company_profile_changes')
			.select('company_id, changes, status')
			.eq('id', body.id)
			.maybeSingle();

		if (readError) error(500, readError.message);
		if (!request_) error(404, 'Request not found.');
		if (request_.status !== 'pending') error(409, 'This request has already been decided.');

		// The verdict is what writes public.companies — the founder's own grant on
		// these columns was revoked, so this is the only path they can take.
		if (approved) {
			const changes = request_.changes as Record<string, { to: string }>;
			const update: Record<string, string> = {};
			if (changes.companyName) {
				update.company_name = changes.companyName.to;
				update.company_slug = changes.companyName.to
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/^-+|-+$/g, '')
					.slice(0, 64);
			}
			if (changes.website) update.website = changes.website.to;
			if (changes.contactName) update.contact_name = changes.contactName.to;
			if (changes.contactEmail) update.contact_email = changes.contactEmail.to;
			if (changes.phone) update.phone = changes.phone.to;

			if (Object.keys(update).length > 0) {
				const { error: applyError } = await ctx.db
					.from('companies')
					.update(update)
					.eq('id', request_.company_id as string);
				if (applyError) error(500, applyError.message);
			}

			// The company name travels with every posting, so a rename that did not
			// reach them would leave the board showing the old one.
			if (update.company_name) {
				await ctx.db
					.from('jobs')
					.update({ company: update.company_name, company_slug: update.company_slug })
					.eq('company_id', request_.company_id as string);
			}
		}

		const { error: closeError } = await ctx.db
			.from('company_profile_changes')
			.update({
				status: approved ? 'approved' : 'rejected',
				review_note: note,
				reviewed_at: new Date().toISOString(),
				reviewed_by: ctx.admin.userId
			})
			.eq('id', body.id);
		if (closeError) error(500, closeError.message);

		await logAdminAction(ctx, `${approved ? 'applied' : 'refused'} a company details change`, {
			table: 'company_profile_changes',
			recordId: body.id,
			after: { status: approved ? 'approved' : 'rejected', note }
		});
		return json({ ok: true });
	}

	error(400, 'Unknown approval kind.');
};
