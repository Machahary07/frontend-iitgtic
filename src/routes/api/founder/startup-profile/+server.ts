import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { logFounderAction, requireCompanyOwner } from '$lib/server/founderGuard';
import { ensureProfile } from '$lib/server/startupProfiles';
import { missingForReview, sanitizeProfile } from '$lib/utils/startupProfile';
import type { RequestHandler } from './$types';

// The founder's side of their public profile. They edit a draft; the public
// page only changes when TIC approves it in Approvals.
//
// PUT  { companyId, draft }                     save the draft
// POST { companyId, action: 'submit' | 'withdraw' }

async function profileFor(companyId: string) {
	const profile = await ensureProfile(companyId);
	if (!profile) error(409, 'The public profile opens once TIC accepts your application.');
	return profile;
}

export const PUT: RequestHandler = async ({ cookies, request }) => {
	const body = (await request.json().catch(() => ({}))) as { companyId?: string; draft?: unknown };
	const ctx = await requireCompanyOwner(cookies, body.companyId);
	const profile = await profileFor(ctx.companyId);
	if (profile.draft_status === 'in_review') {
		error(409, 'TIC is reviewing your profile. Withdraw it from review to make changes.');
	}

	const { error: dbError } = await supabaseAdmin
		.from('startup_profiles')
		.update({ draft: sanitizeProfile(body.draft), draft_status: 'draft' })
		.eq('id', profile.id);
	if (dbError) error(500, dbError.message);
	return json({ ok: true });
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	const body = (await request.json().catch(() => ({}))) as { companyId?: string; action?: string };
	const ctx = await requireCompanyOwner(cookies, body.companyId);
	const profile = await profileFor(ctx.companyId);

	if (body.action === 'submit') {
		if (profile.draft_status === 'in_review') return json({ ok: true });
		const missing = missingForReview(profile.draft);
		if (missing.length) error(400, `Fill these in first: ${missing.join(', ')}.`);
		const { error: dbError } = await supabaseAdmin
			.from('startup_profiles')
			.update({ draft_status: 'in_review', submitted_at: new Date().toISOString() })
			.eq('id', profile.id);
		if (dbError) error(500, dbError.message);
		await logFounderAction(ctx, 'sent the public profile to TIC for review', {
			table: 'startup_profiles',
			recordId: profile.id
		});
		return json({ ok: true });
	}

	if (body.action === 'withdraw') {
		if (profile.draft_status !== 'in_review') return json({ ok: true });
		await supabaseAdmin.from('startup_profiles').update({ draft_status: 'draft' }).eq('id', profile.id);
		return json({ ok: true });
	}

	error(400, 'Unknown action.');
};
