import { adminDb } from '$lib/server/adminData';
import type { PageServerLoad } from './$types';

const AUDIT_PAGE_SIZE = 100;

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);

	const [audit, impressions, recent] = await Promise.all([
		db
			.from('audit_log')
			.select(
				'id, occurred_at, source, actor_id, actor_label, action, table_name, record_id, before, after'
			)
			.order('id', { ascending: false })
			.limit(AUDIT_PAGE_SIZE),
		db.rpc('page_impressions', { since: null }),
		db
			.from('page_views')
			.select('id, occurred_at, path, visitor_id, actor_label, is_admin, referrer, status')
			.order('id', { ascending: false })
			.limit(40)
	]);

	return {
		entries: audit.data ?? [],
		impressions: impressions.data ?? [],
		recent: recent.data ?? []
	};
};
