import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { adminAlertRecipient, emailConfig, sendTemplateEmail } from '$lib/server/email';
import { runResumeRetention } from '$lib/server/resumes';
import type { RequestHandler } from './$types';

// Daily, from Vercel Cron (vercel.json). Vercel sends CRON_SECRET as a bearer
// token; without the secret set, the route refuses everything rather than let
// anyone trigger deletions.

export const GET: RequestHandler = async ({ request }) => {
	const secret = env.CRON_SECRET?.trim();
	if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
		error(401, 'Unauthorized.');
	}

	const site = emailConfig().siteUrl;
	const result = await runResumeRetention(async (job, count, clearOn) => {
		let to = adminAlertRecipient();
		let toName = 'TIC team';
		let manageUrl = `${site}/tic-admin/job-applications?role=`;

		if (job.owner === 'incubatee' && job.company_id) {
			const { data: company } = await supabaseAdmin
				.from('companies')
				.select('contact_name, contact_email, email')
				.eq('id', job.company_id)
				.maybeSingle();
			to = (company?.contact_email as string) || (company?.email as string) || '';
			toName = (company?.contact_name as string) ?? '';
			manageUrl = `${site}/founder/applicants`;
		}
		if (!to) return;

		await sendTemplateEmail({
			templateKey: 'resumes-clearing-soon',
			to,
			toName,
			variables: {
				role: job.role,
				count: String(count),
				clearOn: clearOn.toLocaleDateString('en-GB', {
					day: 'numeric',
					month: 'short',
					year: 'numeric',
					timeZone: 'Asia/Kolkata'
				}),
				manageUrl
			},
			context: { table: 'jobs', recordId: job.id }
		});
	});

	return json({ ok: true, ...result });
};
