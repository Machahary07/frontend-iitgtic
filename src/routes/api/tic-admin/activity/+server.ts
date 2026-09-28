import { withoutDeveloperActivity } from '$lib/server/auditFilter';
import { error, json } from '@sveltejs/kit';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import { FULL_ADMIN_ROLES } from '$lib/utils/roles';
import type { RequestHandler } from './$types';

// Reads the audit trail and the traffic log. Both tables have RLS on with no
// policies, so this service-role route is the only way to see them.

const PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 100;

// ?page=&size= asks for one numbered page and the total, for the console's
// pagination bar. Without them the older cursor form (?before=) still works.
function pageOf(url: URL): { from: number; to: number } | null {
	const page = Number(url.searchParams.get('page'));
	if (!Number.isInteger(page) || page < 1) return null;
	const raw = Number(url.searchParams.get('size'));
	const size = Number.isInteger(raw) && raw > 0 ? Math.min(raw, MAX_PAGE_SIZE) : 25;
	const from = (page - 1) * size;
	return { from, to: from + size - 1 };
}

export const GET: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireAdmin(cookies);

	const view = url.searchParams.get('view') ?? 'audit';
	const before = url.searchParams.get('before');

	const paged = pageOf(url);

	if (view === 'audit') {
		let query = withoutDeveloperActivity(
			ctx.db
				.from('audit_log')
				.select(
					'id, occurred_at, source, actor_id, actor_label, action, table_name, record_id, before, after',
					paged ? { count: 'exact' } : undefined
				)
		).order('id', { ascending: false });

		query = paged ? query.range(paged.from, paged.to) : query.limit(PAGE_SIZE);
		if (before && !paged) query = query.lt('id', Number(before));

		const table = url.searchParams.get('table');
		if (table && table !== 'all') query = query.eq('table_name', table);

		const { data, error: dbError, count } = await query;
		if (dbError) error(500, dbError.message);
		return json({ entries: data ?? [], total: count ?? null });
	}

	if (view === 'visits') {
		const range = paged ?? { from: 0, to: 24 };
		const {
			data,
			error: dbError,
			count
		} = await ctx.db
			.from('page_views')
			.select('id, occurred_at, path, visitor_id, actor_label, is_admin, referrer, status', {
				count: 'exact'
			})
			.order('id', { ascending: false })
			.range(range.from, range.to);
		if (dbError) error(500, dbError.message);
		return json({ visits: data ?? [], total: count ?? 0 });
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

// Clears one of the two logs. Only the full admins (Developer, Admin) may, and
// judged on the real person, so viewing as an admin lends nothing. It cannot be
// undone: the rows are deleted, not hidden.
//
// DELETE ?view=audit        every audit entry, then one entry saying who cleared it
// DELETE ?view=impressions  every recorded page view
export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireAdmin(cookies);
	const actingRole = ctx.admin.actor?.role ?? ctx.admin.role;
	if (!FULL_ADMIN_ROLES.includes(actingRole)) {
		error(403, 'Only a Developer or an Admin can clear the logs.');
	}

	const view = url.searchParams.get('view');
	const table = view === 'audit' ? 'audit_log' : view === 'impressions' ? 'page_views' : null;
	if (!table) error(400, 'Unknown log.');

	// A delete needs a filter; every identity id is positive, so this is all rows.
	const { error: dbError, count } = await ctx.db.from(table).delete({ count: 'exact' }).gt('id', 0);
	if (dbError) error(500, dbError.message);

	// Written after the delete, so a cleared log still says who cleared it.
	await logAdminAction(
		ctx,
		view === 'audit'
			? `cleared the audit log (${count ?? 0} entries)`
			: `cleared page impressions (${count ?? 0} page views)`
	);

	return json({ ok: true, cleared: count ?? 0 });
};
