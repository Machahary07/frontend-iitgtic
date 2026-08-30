import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

// Full-access client for the TIC team admin routes. It bypasses RLS, so it must
// only ever be imported from files under $lib/server or +server.ts — SvelteKit
// will fail the build if this module is ever pulled into a browser bundle.
export const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false }
});
