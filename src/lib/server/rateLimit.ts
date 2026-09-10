import { supabaseAdmin } from '$lib/server/supabaseAdmin';

// Rate limiting for the public write routes.
//
// The counter is a Postgres row, not a module-level Map: this app is deployed
// serverless, so an in-memory counter is per-instance, resets on every cold
// start, and is defeated by fanning requests out across instances. The
// insert-or-increment in public.rate_limit_hit() is one atomic statement, so
// concurrent requests cannot both read a stale count.
//
// A limiter that cannot reach the database allows the request. Locking people
// out of an application form because the counter is unavailable is a worse
// outcome than briefly failing open on a route that has other defences.

export type Limit = { windowSeconds: number; max: number };

// Deliberately generous: these stop scripted abuse, not people. A slow form
// filled in twice is normal; forty submissions from one address is not.
export const LIMITS = {
	// Per IP. A role application takes minutes to fill in honestly.
	jobApplication: { windowSeconds: 3600, max: 10 } satisfies Limit,
	// Per IP. The signup receipt is one call per account created.
	signupReceipt: { windowSeconds: 3600, max: 10 } satisfies Limit,
	// Per IP. Fired once per application submitted; a slow founder submitting a
	// second application in the same hour is normal, a script is not.
	applicationReceipt: { windowSeconds: 3600, max: 10 } satisfies Limit,
	// Per IP. The welcome / confirm-your-email send — once at signup, plus the odd
	// "resend" from someone who did not get it. A handful an hour is generous.
	founderWelcome: { windowSeconds: 3600, max: 8 } satisfies Limit,
	// Per IP. The sign-in notice fires once per login; the real brake on how often
	// it actually sends is the 24h throttle in the route, so this only stops abuse.
	founderLogin: { windowSeconds: 3600, max: 20 } satisfies Limit,
	// Per IP. The widget verifies once per form; a retry or two is normal.
	turnstile: { windowSeconds: 600, max: 30 } satisfies Limit,
	// Per IP. Guards the bootstrap password, which is a plain shared secret.
	adminLogin: { windowSeconds: 900, max: 10 } satisfies Limit,
	// Per IP. Subscribing is one action; this only stops a script filling the list.
	newsletter: { windowSeconds: 3600, max: 15 } satisfies Limit
} as const;

let lastSweep = 0;
const SWEEP_EVERY_MS = 60 * 60 * 1000;

// Old windows are dead weight. Swept from whichever instance happens to notice
// the hour has passed rather than on a schedule, so this needs no pg_cron.
function maybeSweep(): void {
	if (Date.now() - lastSweep < SWEEP_EVERY_MS) return;
	lastSweep = Date.now();
	void supabaseAdmin.rpc('rate_limit_sweep').then(({ error }) => {
		if (error) console.error('[rate-limit] sweep failed:', error.message);
	});
}

/**
 * Records one hit and says whether it is within the limit. Never throws.
 *
 * `identifier` is whatever the bucket counts by — usually the client address.
 */
export async function withinLimit(
	bucket: keyof typeof LIMITS,
	identifier: string,
	limit: Limit = LIMITS[bucket]
): Promise<boolean> {
	maybeSweep();

	const { data, error } = await supabaseAdmin.rpc('rate_limit_hit', {
		p_bucket: bucket,
		p_identifier: identifier || 'unknown',
		p_window_seconds: limit.windowSeconds,
		p_max_hits: limit.max
	});

	if (error) {
		console.error('[rate-limit] check failed, allowing:', error.message);
		return true;
	}
	return data !== false;
}

// Minutes, for the "try again in N minutes" line in the error message.
export function retryMinutes(limit: Limit): number {
	return Math.max(1, Math.round(limit.windowSeconds / 60));
}
