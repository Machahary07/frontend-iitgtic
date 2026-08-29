import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import type { RequestHandler } from './$types';

// A company can delete its own account. Removing the row from `companies` is
// something RLS already allows, but the underlying auth user can only be deleted
// with the service role — otherwise the login would survive the account.

export const DELETE: RequestHandler = async ({ request }) => {
	const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
	if (!token) error(401, 'Missing access token.');

	const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
	if (authError || !data.user) error(401, 'Invalid session.');

	const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(data.user.id);
	if (deleteError) error(500, deleteError.message);

	return json({ ok: true });
};
