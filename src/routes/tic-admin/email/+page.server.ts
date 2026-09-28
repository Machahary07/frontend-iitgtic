import { adminDb } from '$lib/server/adminData';
import { emailConfig, emailUsage, listSuppressions, resolveAllTemplates } from '$lib/server/email';
import { describeDomain, domainStatus } from '$lib/server/resendDomains';
import { EMAIL_LAYOUT_KEY } from '$lib/utils/emailTemplates';
import { emailLogPage } from '$lib/server/emailLog';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 25;

// Everything the Email screen needs on first paint: the meter, the last page of
// the log, and enough of the template list to show what is customised and what
// is switched off. Other pages of the log are fetched from /api/tic-admin/email.

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);
	const config = emailConfig();

	const [usage, templates, log, daily, suppressions, sendingDomain, newsletter] = await Promise.all(
		[
			emailUsage(config),
			resolveAllTemplates(),
			// First page of the log under the default view (every status, test sends
			// hidden). Other pages and filters come from /api/tic-admin/email.
			emailLogPage(db, { status: 'all', tests: false, page: 1, size: PAGE_SIZE }),
			// Thirty days of statuses, aggregated in the page rather than in SQL: at a
			// few thousand rows a month this is one small query, and it keeps the
			// schema free of a view that would need migrating alongside the table.
			db
				.from('email_log')
				.select('created_at, status')
				.gte('created_at', new Date(Date.now() - 29 * 86_400_000).toISOString())
				.order('created_at', { ascending: true }),
			// Addresses that hard-bounced or filed a complaint. Nothing is sent to
			// these, so they belong next to the meter rather than buried in the log.
			listSuppressions(),
			// Asked of Resend rather than guessed from the From address: an address on
			// an unverified domain looks fine and still fails at send time.
			domainStatus(config.from),
			// Count only — the addresses themselves are pulled on demand by the export
			// rather than shipped into the HTML of a page that just shows a number.
			db
				.from('newsletter_subscribers')
				.select('id', { count: 'exact', head: true })
				.is('unsubscribed_at', null)
		]
	);

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
		log: log.rows,
		logTotal: log.total,
		logCounts: log.counts,
		logTestSends: log.testSends,
		logPageSize: PAGE_SIZE,
		trend: [...buckets].map(([day, counts]) => ({ day, ...counts })),
		suppressions,
		// The sentence is built here rather than in the component: resendDomains
		// is a $lib/server module and must not reach the browser bundle.
		sendingDomain: { ...sendingDomain, description: describeDomain(sendingDomain) },
		newsletterCount: newsletter.count ?? 0
	};
};
