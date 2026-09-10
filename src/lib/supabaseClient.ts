import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';

// persistSession + autoRefreshToken keep a founder or company signed in across
// refreshes and token expiries — set explicitly so a signed-in user is never
// dropped on their own; they stay in until they choose to log out. (These are
// the supabase-js defaults; pinning them documents the intent and guards against
// a future default change.)
export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true
	}
});
