import { redirect } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { issueTicAdminSession, readTicAdminSession } from '$lib/server/ticAdminSession';
import type { LayoutServerLoad } from './$types';

// The admin gate runs here rather than in each page's onMount. Reading a signed
// cookie is free, so a page arrives already authenticated and already rendered —
// which is why moving between sections no longer flashes an empty screen.

export const load: LayoutServerLoad = async ({ cookies, url }) => {
	const admin = readTicAdminSession(cookies);

	// The login screen lives under /tic-admin too, so it opts out of the gate and
	// instead needs to know whether the console still has no admin at all.
	if (url.pathname === '/tic-admin/login') {
		// A failed query and an empty table both come back with no rows, so the
		// error has to be checked separately — treating "could not read" as "no
		// admin exists" is what made a bad key look like a first run.
		let dbError: string | null = null;
		let count: number | null = null;
		try {
			const res = await supabaseAdmin
				.from('profiles')
				.select('id', { count: 'exact', head: true })
				.eq('role', 'admin');
			if (res.error) {
				dbError =
					res.error.message ||
					`The database rejected the request (${res.error.code || 'no code'}). The service role key is probably wrong or belongs to another project.`;
			}
			count = res.count;
		} catch (err) {
			// Thrown rather than returned: the host is unreachable, so the URL is
			// wrong or there is no network.
			dbError = `Could not reach ${new URL(PUBLIC_SUPABASE_URL).host} — ${err instanceof Error ? err.message : String(err)}`;
		}

		if (dbError) console.error('[tic-admin] admin lookup failed:', dbError);

		return { admin, needsBootstrap: !dbError && (count ?? 0) === 0, dbError };
	}

	if (!admin) redirect(303, '/tic-admin/login');

	// Sliding session: renew the cookie on each visit so an active admin is never
	// logged out on their own — only an explicit logout or ~30 days away ends it.
	issueTicAdminSession(cookies, admin);

	return { admin, needsBootstrap: false, dbError: null };
};
