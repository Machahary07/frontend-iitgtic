import { redirect } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { readTicAdminSession } from '$lib/server/ticAdminSession';
import type { LayoutServerLoad } from './$types';

// The admin gate runs here rather than in each page's onMount. Reading a signed
// cookie is free, so a page arrives already authenticated and already rendered —
// which is why moving between sections no longer flashes an empty screen.

export const load: LayoutServerLoad = async ({ cookies, url }) => {
	const admin = readTicAdminSession(cookies);

	// The login screen lives under /tic-admin too, so it opts out of the gate and
	// instead needs to know whether the console still has no admin at all.
	if (url.pathname === '/tic-admin/login') {
		const { count } = await supabaseAdmin
			.from('profiles')
			.select('id', { count: 'exact', head: true })
			.eq('role', 'admin');
		return { admin, needsBootstrap: (count ?? 0) === 0 };
	}

	if (!admin) redirect(303, '/tic-admin/login');

	return { admin, needsBootstrap: false };
};
