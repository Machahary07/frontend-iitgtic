import { error, json } from '@sveltejs/kit';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { sendTemplateEmail } from '$lib/server/email';
import { profileById } from '$lib/server/startupProfiles';
import { canOpen } from '$lib/utils/roles';
import type { RequestHandler } from './$types';

// The verdict side of the founder queues. One route rather than three
// because the decision is the same shape every time — approve, or reject with a
// reason the founder will read — and because the approvals screen sends them all
// from one place.
//
// PATCH { kind: 'member' | 'profile', id, decision, note? }

type Body = {
	kind?: 'company' | 'member' | 'profile' | 'startup';
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

	// A public profile: approving copies the draft to what the website shows.
	// Publishing to the site is for the roles that may edit its content.
	if (body.kind === 'startup') {
		if (!canOpen(ctx.admin.actor?.role ?? ctx.admin.role, 'content')) {
			error(403, 'Admins, TIC Admins and Coordinators decide public profiles.');
		}
		if (!approved && !note) error(400, 'Say what to change — the founder reads it.');
		const profile = await profileById(body.id);
		if (!profile) error(404, 'Profile not found.');
		if (profile.draft_status !== 'in_review') error(409, 'This has already been decided.');

		const { error: dbError } = await supabaseAdmin
			.from('startup_profiles')
			.update({
				...(approved ? { published: profile.draft } : {}),
				draft_status: approved ? 'approved' : 'sent_back',
				review_note: approved ? null : note,
				reviewed_at: new Date().toISOString(),
				reviewed_by: ctx.admin.userId
			})
			.eq('id', profile.id);
		if (dbError) error(500, dbError.message);

		await logAdminAction(
			ctx,
			`${approved ? 'approved' : 'sent back'} the public profile of ${profile.draft.name || profile.slug}`,
			{ table: 'startup_profiles', recordId: profile.id }
		);

		if (profile.company_id) {
			const { data: company } = await supabaseAdmin
				.from('companies')
				.select('email, contact_email, contact_name')
				.eq('id', profile.company_id)
				.maybeSingle();
			const to = (company?.contact_email as string) || (company?.email as string) || '';
			if (to) {
				await sendTemplateEmail({
					templateKey: 'startup-profile-reviewed',
					to,
					toName: (company?.contact_name as string) ?? '',
					variables: {
						fullName: ((company?.contact_name as string) ?? '').split(' ')[0] ?? '',
						startupName: profile.draft.name || profile.slug,
						approved: approved ? '1' : '',
						isListed: profile.listed ? '1' : '',
						note: note ?? ''
					},
					context: { table: 'startup_profiles', recordId: profile.id },
					sentBy: ctx.admin.userId
				});
			}
		}
		return json({ ok: true });
	}

	error(400, 'Unknown approval kind.');
};
