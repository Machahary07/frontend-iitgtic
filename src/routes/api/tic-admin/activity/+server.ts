import { error, json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/adminGuard';
import type { RequestHandler } from './$types';

// Reads the audit trail and the traffic log. Both tables have RLS on with no
// policies, so this service-role route is the only way to see them.

const PAGE_SIZE = 100;

export const GET: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireAdmin(cookies);

	const view = url.searchParams.get('view') ?? 'audit';
	const before = url.searchParams.get('before');

	if (view === 'audit') {
		let query = ctx.db
			.from('audit_log')
			.select('id, occurred_at, source, actor_id, actor_label, action, table_name, record_id, before, after')
			.order('id', { ascending: false })
			.limit(PAGE_SIZE);

		if (before) query = query.lt('id', Number(before));

		const table = url.searchParams.get('table');
		if (table && table !== 'all') query = query.eq('table_name', table);

		const { data, error: dbError } = await query;
		if (dbError) error(500, dbError.message);
		return json({ entries: data ?? [] });
	}

	if (view === 'impressions') {
		const range = url.searchParams.get('range') ?? 'all';
		const days = range === '7d' ? 7 : range === '30d' ? 30 : null;
		const since = days ? new Date(Date.now() - days * 86400000).toISOString() : null;

		const { data, error: dbError } = await ctx.db.rpc('page_impressions', { since });
		if (dbError) error(500, dbError.message);
		return json({ impressions: data ?? [] });
	}

	error(400, 'Unknown view.');
};
