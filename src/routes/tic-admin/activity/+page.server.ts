import { adminDb } from '$lib/server/adminData';
import type { PageServerLoad } from './$types';

// The first page of each list, sized to the pagination bar's default. A reader
// who prefers another size gets it fetched on arrival; see the page.
const FIRST_PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);

	const [audit, impressions, recent] = await Promise.all([
		db
			.from('audit_log')
			.select(
				'id, occurred_at, source, actor_id, actor_label, action, table_name, record_id, before, after',
				{ count: 'exact' }
			)
			.order('id', { ascending: false })
			.range(0, FIRST_PAGE_SIZE - 1),
		db.rpc('page_impressions', { since: null }),
		db
			.from('page_views')
			.select('id, occurred_at, path, visitor_id, actor_label, is_admin, referrer, status', {
				count: 'exact'
			})
			.order('id', { ascending: false })
			.range(0, FIRST_PAGE_SIZE - 1)
	]);

	return {
		entries: audit.data ?? [],
		auditTotal: audit.count ?? 0,
		impressions: impressions.data ?? [],
		recent: recent.data ?? [],
		recentTotal: recent.count ?? 0,
		firstPageSize: FIRST_PAGE_SIZE
	};
};
