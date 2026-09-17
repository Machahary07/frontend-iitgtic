import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import type { RequestHandler } from './$types';
import { clearTicAdminSession } from '$lib/server/ticAdminSession';
import { clearFounderSession } from '$lib/server/founderSession';

// Closing your own account. Deleting the auth user is the only part that needs
// the service role — a login that survives the account would be worse than
// leaving both in place.
//
// The companies the person created go with it: companies.owner_id cascades on
// delete, and jobs cascade from there. Applicants and any incubation application
// keep their rows and lose the link, so TIC's record of what it reviewed does
// not disappear with the account.

export const DELETE: RequestHandler = async ({ request, cookies }) => {
	const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
	if (!token) error(401, 'Missing access token.');

	const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
	if (authError || !data.user) error(401, 'Invalid session.');

	const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(data.user.id);
	if (deleteError) error(500, deleteError.message);
	clearTicAdminSession(cookies);
	clearFounderSession(cookies);

	return json({ ok: true });
};
