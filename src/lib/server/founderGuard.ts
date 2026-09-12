import { error } from '@sveltejs/kit';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { readFounderSession, type FounderSession } from '$lib/server/founderSession';
import type { Cookies } from '@sveltejs/kit';

// The founder counterpart to requireAdmin(). Same shape, same actor tagging, and
// deliberately the same service-role client — every read it performs is scoped
// to the caller's own company by the query, because a founder route has to see
// rows (its own pending jobs, its own team) that RLS hides from the public.
//
// Every query written against this client must carry the company filter itself.
// That is the whole security boundary here, so it is stated once per function
// rather than left to a policy.

export type FounderContext = {
	founder: FounderSession;
	companyId: string;
	db: SupabaseClient;
};

export function founderDb(userId: string): SupabaseClient {
	return createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
		global: { headers: { 'x-actor-id': userId } }
	});
}

/** Signed in, attached to a company, and approved by TIC. */
export function requireFounder(cookies: Cookies): FounderContext {
	const founder = readFounderSession(cookies);
	if (!founder) error(401, 'Not signed in.');
	if (!founder.companyId) error(403, 'This account is not attached to a company yet.');
	if (founder.memberStatus !== 'approved') {
		error(403, 'This account is waiting for TIC to approve it.');
	}

	return { founder, companyId: founder.companyId, db: founderDb(founder.userId) };
}

/** Only the person who signed the company up may manage the team or its profile. */
export function requireFounderOwner(cookies: Cookies): FounderContext {
	const ctx = requireFounder(cookies);
	if (ctx.founder.memberRole !== 'owner') {
		error(403, 'Only the company owner can do this.');
	}
	return ctx;
}

// High-level intent alongside the row-level trigger entries, so /founder/activity
// and the TIC audit log both read as sentences rather than as table names.
export async function logFounderAction(
	ctx: FounderContext,
	action: string,
	details: { table?: string; recordId?: string; after?: unknown } = {}
): Promise<void> {
	await ctx.db.from('audit_log').insert({
		source: 'app',
		actor_id: ctx.founder.userId,
		actor_label: `${ctx.founder.name || ctx.founder.email} (founder)`,
		action,
		table_name: details.table ?? null,
		record_id: details.recordId ?? null,
		after: details.after ?? null
	});
}
