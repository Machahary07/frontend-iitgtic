import { adminDb } from '$lib/server/adminData';
import { emailConfig, emailUsage, resolveAllTemplates } from '$lib/server/email';
import { EMAIL_LAYOUT_KEY } from '$lib/utils/emailTemplates';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 25;

// Everything the Email screen needs on first paint: the meter, the last page of
// the log, and enough of the template list to show what is customised and what
// is switched off. Older log rows are fetched from /api/tic-admin/email.

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);
	const config = emailConfig();

	const [usage, templates, log, daily] = await Promise.all([
		emailUsage(config),
		resolveAllTemplates(),
		db
			.from('email_log')
			.select(
				'id, template_key, to_email, to_name, subject, status, provider_id, error, is_test, context, created_at'
			)
			.order('created_at', { ascending: false })
			.limit(PAGE_SIZE),
		// Thirty days of statuses, aggregated in the page rather than in SQL: at a
		// few thousand rows a month this is one small query, and it keeps the
		// schema free of a view that would need migrating alongside the table.
		db
			.from('email_log')
			.select('created_at, status')
			.gte('created_at', new Date(Date.now() - 29 * 86_400_000).toISOString())
			.order('created_at', { ascending: true })
	]);

	const buckets = new Map<string, { sent: number; failed: number; blocked: number }>();
	for (let i = 29; i >= 0; i -= 1) {
		buckets.set(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10), {
			sent: 0,
			failed: 0,
			blocked: 0
		});
	}
	for (const row of (daily.data ?? []) as { created_at: string; status: string }[]) {
		const bucket = buckets.get(row.created_at.slice(0, 10));
		if (bucket && row.status in bucket) bucket[row.status as keyof typeof bucket] += 1;
	}

	return {
		config: {
			configured: config.configured,
			from: config.from,
			replyTo: config.replyTo,
			siteUrl: config.siteUrl,
			usingTestSender: config.usingTestSender,
			plan: config.plan,
			monthlyLimit: config.monthlyLimit,
			dailyLimit: config.dailyLimit
		},
		usage,
		templates: templates.filter((t) => t.key !== EMAIL_LAYOUT_KEY),
		log: log.data ?? [],
		hasMore: (log.data?.length ?? 0) === PAGE_SIZE,
		trend: [...buckets].map(([day, counts]) => ({ day, ...counts }))
	};
};
