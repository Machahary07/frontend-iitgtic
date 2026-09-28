import type { SupabaseClient } from '@supabase/supabase-js';

// One page of the email delivery log, with its filter applied in the database
// and the counts the tabs show. Shared by the Email screen's load (the first
// page) and /api/tic-admin/email (every other page), so both agree exactly.

export type LogStatus = 'all' | 'sent' | 'failed' | 'blocked';

const COLUMNS =
	'id, template_key, to_email, to_name, subject, status, provider_id, error, is_test, context, created_at';

export async function emailLogPage(
	db: SupabaseClient,
	options: { status: LogStatus; tests: boolean; page: number; size: number }
) {
	const from = (options.page - 1) * options.size;

	let rows = db
		.from('email_log')
		.select(COLUMNS, { count: 'exact' })
		.order('created_at', { ascending: false })
		.range(from, from + options.size - 1);
	if (options.status !== 'all') rows = rows.eq('status', options.status);
	if (!options.tests) rows = rows.eq('is_test', false);

	// Head-only counts: a number each, no rows shipped.
	const count = (status: LogStatus, tests: boolean | 'only') => {
		let query = db.from('email_log').select('id', { count: 'exact', head: true });
		if (status !== 'all') query = query.eq('status', status);
		if (tests === 'only') query = query.eq('is_test', true);
		else if (!tests) query = query.eq('is_test', false);
		return query.then(({ count: n }) => n ?? 0);
	};

	const [page, all, sent, failed, blocked, testSends] = await Promise.all([
		rows,
		count('all', options.tests),
		count('sent', options.tests),
		count('failed', options.tests),
		count('blocked', options.tests),
		count('all', 'only')
	]);

	return {
		rows: page.data ?? [],
		total: page.count ?? 0,
		counts: { all, sent, failed, blocked },
		/** Test sends in the whole log — what "Include test sends" would add. */
		testSends,
		error: page.error?.message ?? null
	};
}

export function readLogStatus(value: string | null): LogStatus {
	return value === 'sent' || value === 'failed' || value === 'blocked' ? value : 'all';
}
