import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { logAdminAction, requireAdmin, type AdminContext } from '$lib/server/adminGuard';
import { reviewScope } from '$lib/server/applicationReview';
import { sendTemplateEmail } from '$lib/server/email';
import { ensureProfile, goLive, profileById } from '$lib/server/startupProfiles';
import { uploadProfileImage } from '$lib/server/profileImages';
import { sanitizeProfile } from '$lib/utils/startupProfile';
import { canOpen } from '$lib/utils/roles';
import type { RequestHandler } from './$types';

// The console's side of incubatee profiles.
//
// PATCH { id, action, ... }  where a startup sits on the site — admin only:
//   'list'      { virtual }   on the site as a current incubatee
//   'virtual'   { value }     add to / remove from Virtual
//   'graduate'  { outcome }   move to Graduated, and tell the founder
//   'exit'                    take it off the site, keeping the record
// PUT   { id, draft, publish }  edit the profile — staff who edit site content
// POST  multipart { id, file }  an image for it → { url }
// POST  { companyId }             start the profile of an accepted startup, from
//                                 its application, before the founder has → { id }

const realRole = (ctx: AdminContext) => ctx.admin.actor?.role ?? ctx.admin.role;

async function load(id: unknown) {
	if (typeof id !== 'string' || !id) error(400, 'Missing profile id.');
	const profile = await profileById(id);
	if (!profile) error(404, 'Profile not found.');
	return profile;
}

export const PATCH: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);
	if (reviewScope({ role: realRole(ctx) }) !== 'admin') error(403, 'Only admin moves startups on the site.');
	const body = (await request.json().catch(() => ({}))) as {
		id?: string;
		action?: string;
		virtual?: boolean;
		value?: boolean;
		outcome?: string;
	};
	const profile = await load(body.id);
	const name = profile.published?.name || profile.draft.name || profile.slug;
	const update = (fields: Record<string, unknown>) =>
		supabaseAdmin.from('startup_profiles').update(fields).eq('id', profile.id);

	switch (body.action) {
		case 'list': {
			const refusal = await goLive(profile.id, body.virtual === true);
			if (refusal) error(409, refusal);
			await logAdminAction(ctx, `listed ${name} on the site`, { table: 'startup_profiles', recordId: profile.id });
			break;
		}
		case 'virtual': {
			if (profile.stage !== 'current') error(409, 'Only a current incubatee can be virtual.');
			await update({ is_virtual: body.value === true });
			await logAdminAction(ctx, `${body.value ? 'added' : 'removed'} ${name} ${body.value ? 'to' : 'from'} Virtual incubatees`, {
				table: 'startup_profiles',
				recordId: profile.id
			});
			break;
		}
		case 'graduate': {
			if (profile.stage === 'graduated') return json({ ok: true });
			if (!profile.published) error(409, 'Approve the startup’s public profile first.');
			const outcome = (body.outcome ?? '').trim().slice(0, 300);
			await update({
				stage: 'graduated',
				listed: true,
				graduated_at: new Date().toISOString(),
				published: { ...profile.published, graduateOutcome: outcome || profile.published.graduateOutcome },
				draft: { ...profile.draft, graduateOutcome: outcome || profile.draft.graduateOutcome }
			});
			await logAdminAction(ctx, `graduated ${name}`, { table: 'startup_profiles', recordId: profile.id });
			if (profile.company_id) {
				const { data: company } = await supabaseAdmin
					.from('companies')
					.select('email, contact_email, contact_name')
					.eq('id', profile.company_id)
					.maybeSingle();
				const to = (company?.contact_email as string) || (company?.email as string) || '';
				if (to) {
					await sendTemplateEmail({
						templateKey: 'startup-graduated',
						to,
						toName: (company?.contact_name as string) ?? '',
						variables: {
							fullName: ((company?.contact_name as string) ?? '').split(' ')[0] ?? '',
							startupName: name,
							outcome,
							profileUrl: `/incubated-startups/graduated/${profile.slug}`
						},
						context: { table: 'startup_profiles', recordId: profile.id },
						sentBy: ctx.admin.userId
					});
				}
			}
			break;
		}
		case 'exit': {
			await update({ stage: 'exited', listed: false });
			await logAdminAction(ctx, `took ${name} off the site`, { table: 'startup_profiles', recordId: profile.id });
			break;
		}
		default:
			error(400, 'Unknown action.');
	}
	return json({ ok: true });
};

export const PUT: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);
	if (!canOpen(realRole(ctx), 'content')) error(403, 'Editing a profile is for staff who edit the site.');
	const body = (await request.json().catch(() => ({}))) as { id?: string; draft?: unknown; publish?: boolean };
	const profile = await load(body.id);
	const draft = sanitizeProfile(body.draft);

	const { error: dbError } = await supabaseAdmin
		.from('startup_profiles')
		.update(
			body.publish
				? { draft, published: draft, draft_status: 'approved', review_note: null, reviewed_at: new Date().toISOString(), reviewed_by: ctx.admin.userId }
				: { draft }
		)
		.eq('id', profile.id);
	if (dbError) error(500, dbError.message);
	await logAdminAction(ctx, `${body.publish ? 'edited and published' : 'edited'} the public profile of ${draft.name || profile.slug}`, {
		table: 'startup_profiles',
		recordId: profile.id
	});
	return json({ ok: true });
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);
	if (!canOpen(realRole(ctx), 'content')) error(403, 'Editing a profile is for staff who edit the site.');
	if (request.headers.get('content-type')?.includes('application/json')) {
		const body = (await request.json().catch(() => ({}))) as { companyId?: string };
		if (!body.companyId) error(400, 'Missing company id.');
		const profile = await ensureProfile(body.companyId);
		if (!profile) error(409, 'Only an accepted startup has a public profile.');
		await logAdminAction(ctx, `started the public profile of ${profile.draft.name || profile.slug}`, {
			table: 'startup_profiles',
			recordId: profile.id
		});
		return json({ id: profile.id });
	}
	const form = await request.formData().catch(() => null);
	const profile = await load(form?.get('id'));
	return json({ url: await uploadProfileImage(profile.id, form?.get('file')) });
};
