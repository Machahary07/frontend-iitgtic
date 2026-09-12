import { error } from '@sveltejs/kit';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { readFounderSession, type FounderSession } from '$lib/server/founderSession';
import type { Cookies } from '@sveltejs/kit';

// The founder counterpart to requireAdmin(). Same shape, same actor tagging, and
// deliberately the same service-role client — every read it performs is scoped
// to one of the caller's own companies by the query, because a founder route has
// to see rows (its own pending jobs, its own team) that RLS hides from everyone.
//
// Which company is never taken on trust. A founder may hold several, so the
// company id arrives from the request and is checked against what they actually
// own or belong to before anything is read or written with it.

export type CompanyStanding = {
	id: string;
	name: string;
	status: 'pending' | 'verified' | 'rejected';
	/** 'owner' created it; 'member' was added to it by the owner. */
	relation: 'owner' | 'member';
};

export type FounderContext = {
	founder: FounderSession;
	companyId: string;
	company: CompanyStanding;
	db: SupabaseClient;
};

export function founderDb(userId: string): SupabaseClient {
	return createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
		global: { headers: { 'x-actor-id': userId } }
	});
}

/**
 * Every company this person may act for: the ones they created, plus any they
 * were added to and TIC approved. One query per relationship rather than a join,
 * because the two mean different things and the caller needs to tell them apart.
 */
export async function listMyCompanies(
	db: SupabaseClient,
	userId: string
): Promise<CompanyStanding[]> {
	const [owned, membership] = await Promise.all([
		db
			.from('companies')
			.select('id, company_name, status')
			.eq('owner_id', userId)
			.order('created_at', { ascending: true }),
		db.from('profiles').select('company_id, member_status').eq('id', userId).maybeSingle()
	]);

	const list: CompanyStanding[] = ((owned.data ?? []) as { id: string; company_name: string; status: string }[]).map(
		(row) => ({
			id: row.id,
			name: row.company_name,
			status: row.status as CompanyStanding['status'],
			relation: 'owner' as const
		})
	);

	const memberOf = membership.data?.company_id as string | null | undefined;
	if (memberOf && membership.data?.member_status === 'approved' && !list.some((c) => c.id === memberOf)) {
		const { data } = await db
			.from('companies')
			.select('id, company_name, status')
			.eq('id', memberOf)
			.maybeSingle();
		if (data) {
			list.push({
				id: data.id as string,
				name: data.company_name as string,
				status: data.status as CompanyStanding['status'],
				relation: 'member'
			});
		}
	}

	return list;
}

/** Signed in, and entitled to act for the company named in the request. */
export async function requireFounder(
	cookies: Cookies,
	companyId: string | null | undefined
): Promise<FounderContext> {
	const founder = readFounderSession(cookies);
	if (!founder) error(401, 'Not signed in.');
	if (!companyId) error(400, 'No company chosen.');

	const db = founderDb(founder.userId);
	const company = (await listMyCompanies(db, founder.userId)).find((c) => c.id === companyId);
	// Not found and not yours are answered the same way: a founder probing ids
	// should not be able to tell a real company from one that does not exist.
	if (!company) error(403, 'That company is not yours.');

	return { founder, companyId, company, db };
}

/** Only the person who created the company may manage its team or its details. */
export async function requireCompanyOwner(
	cookies: Cookies,
	companyId: string | null | undefined
): Promise<FounderContext> {
	const ctx = await requireFounder(cookies, companyId);
	if (ctx.company.relation !== 'owner') {
		error(403, 'Only the founder who created this company can do this.');
	}
	return ctx;
}

/** Signed in, with no company in view yet — creating the first one, for instance. */
export function requireSignedInFounder(cookies: Cookies): {
	founder: FounderSession;
	db: SupabaseClient;
} {
	const founder = readFounderSession(cookies);
	if (!founder) error(401, 'Not signed in.');
	return { founder, db: founderDb(founder.userId) };
}

// High-level intent alongside the row-level trigger entries, so /founder/activity
// and the TIC audit log both read as sentences rather than as table names.
export async function logFounderAction(
	ctx: { founder: FounderSession; db: SupabaseClient },
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
