import { error, json } from '@sveltejs/kit';
import { requireCompanyOwner } from '$lib/server/founderGuard';
import { ensureProfile } from '$lib/server/startupProfiles';
import { uploadProfileImage } from '$lib/server/profileImages';
import type { RequestHandler } from './$types';

// POST multipart { companyId, file } → { url }
export const POST: RequestHandler = async ({ cookies, request }) => {
	const form = await request.formData().catch(() => null);
	const ctx = await requireCompanyOwner(cookies, String(form?.get('companyId') ?? ''));
	const profile = await ensureProfile(ctx.companyId);
	if (!profile) error(409, 'The public profile opens once TIC accepts your application.');
	return json({ url: await uploadProfileImage(profile.id, form?.get('file')) });
};
