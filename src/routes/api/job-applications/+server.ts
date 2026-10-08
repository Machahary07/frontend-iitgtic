import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { adminAlertRecipient, sendTemplateEmail } from '$lib/server/email';
import { applicationCount, getOpenJob } from '$lib/server/jobs';
import { verifyTurnstile } from '$lib/server/turnstile';
import { LIMITS, retryMinutes, withinLimit } from '$lib/server/rateLimit';
import {
	EMAIL_RE,
	RESUME_MAX_BYTES,
	RESUME_TYPES,
	WHY_MAX,
	WHY_MIN,
	resumeExtension
} from '$lib/utils/jobApplications';
import type { RequestHandler } from './$types';

// Public submit route for /opportunities/[id]. Nothing here trusts the browser:
// the Turnstile token is checked against Cloudflare again, the role is looked up
// server-side (so an application cannot be filed against a role that is closed,
// removed or past its closing date), and every field is re-validated before the
// row is written.

const BUCKET = 'job-applications';

function text(form: FormData, key: string): string {
	const value = form.get(key);
	return typeof value === 'string' ? value.trim() : '';
}

export const POST: RequestHandler = async ({ request, url, getClientAddress }) => {
	// Ahead of reading the body: a scripted caller with solved tokens should be
	// stopped before an upload is parsed, not after.
	if (!(await withinLimit('jobApplication', getClientAddress()))) {
		error(
			429,
			`Too many applications from this connection. Try again in ${retryMinutes(LIMITS.jobApplication)} minutes.`
		);
	}

	const form = await request.formData().catch(() => null);
	if (!form) error(400, 'Malformed submission.');

	if (!(await verifyTurnstile(text(form, 'token'), getClientAddress()))) {
		error(400, 'Verification failed. Please complete the check and try again.');
	}

	const job = await getOpenJob(text(form, 'jobSlug'));
	if (!job) error(404, 'This role is no longer accepting applications.');
	if ((await applicationCount(job.id)) >= job.maxApplicants) {
		error(404, 'This role is no longer accepting applications.');
	}

	const fullName = text(form, 'fullName');
	const email = text(form, 'email');
	const applicantRole = text(form, 'applicantRole');
	const why = text(form, 'why');
	const startDate = text(form, 'startDate');
	const portfolioLink = text(form, 'portfolioLink');
	const consent = text(form, 'consent') === 'true';

	if (fullName.length < 2) error(400, 'Please enter your full name.');
	if (!EMAIL_RE.test(email)) error(400, 'Enter a valid email address.');
	if (!applicantRole) error(400, 'Tell us what you do right now.');
	if (why.length < WHY_MIN) error(400, 'A little more detail, please.');
	if (why.length > WHY_MAX) error(400, 'That note is too long.');
	if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) error(400, 'Earliest start date is required.');
	if (portfolioLink && !/^https?:\/\//i.test(portfolioLink)) {
		error(400, 'A portfolio link must start with http:// or https://.');
	}
	if (!consent) error(400, 'Consent is required to share your application.');
	if (job.workMode === 'On-site' && text(form, 'onsiteOk') !== 'true') {
		error(400, 'This role is on-site.');
	}

	const resume = form.get('resume');
	if (!(resume instanceof File) || resume.size === 0) error(400, 'Attach your resume.');
	if (resume.size > RESUME_MAX_BYTES) error(400, 'Your resume must be 2 MB or smaller.');

	const extension = resumeExtension(resume.name);
	if (!extension) error(400, 'Your resume must be a PDF.');
	// The name says PDF; the first bytes have to agree.
	const head = new Uint8Array(await resume.slice(0, 5).arrayBuffer());
	if (String.fromCharCode(...head) !== '%PDF-') error(400, 'That file is not a valid PDF.');

	const safeName = resume.name.replace(/[^A-Za-z0-9._-]+/g, '-');
	const path = `${job.slug}/${Date.now()}-${safeName}`;

	const { error: uploadError } = await supabaseAdmin.storage
		.from(BUCKET)
		.upload(path, resume, { contentType: RESUME_TYPES[extension] });
	if (uploadError) error(500, 'Could not upload your resume. Please try again.');

	const { error: dbError } = await supabaseAdmin.from('job_applications').insert({
		job_id: job.id,
		company_id: job.companyId,
		job_slug: job.slug,
		job_role: job.role,
		job_company: job.company,
		job_source: job.owner === 'tic' ? 'tic' : 'user',
		full_name: fullName,
		email,
		phone: text(form, 'phone'),
		applicant_role: applicantRole,
		portfolio_link: portfolioLink,
		why,
		start_date: startDate,
		onsite_ok: text(form, 'onsiteOk') === 'true',
		consent,
		resume: { path, name: resume.name, size: resume.size, type: RESUME_TYPES[extension] }
	});

	if (dbError) {
		// The row is what makes the file findable, so a failed insert must not
		// leave the upload behind in the bucket.
		await supabaseAdmin.storage.from(BUCKET).remove([path]);

		if (dbError.code === '23505') {
			error(409, 'You have already applied to this role with that email address.');
		}
		error(500, 'Could not save your application. Please try again.');
	}

	// A full role closes itself, so nobody else uploads into it.
	if ((await applicationCount(job.id)) >= job.maxApplicants) {
		await supabaseAdmin
			.from('jobs')
			.update({ status: 'closed', closed_at: new Date().toISOString() })
			.eq('id', job.id)
			.eq('status', 'open');
	}

	// The receipt is the only acknowledgement an applicant gets — they have no
	// account to check a status in. Awaited rather than left to run after the
	// response: on a serverless host the function can be frozen the moment the
	// response is returned, and the send would simply be lost. It cannot fail the
	// request either, because the application is already saved by this point.
	await sendTemplateEmail({
		templateKey: 'job-application-received',
		to: email,
		toName: fullName,
		variables: {
			fullName,
			role: job.role,
			company: job.company,
			jobUrl: `${url.origin}/opportunities/${job.slug}`
		},
		context: { table: 'job_applications', jobSlug: job.slug }
	});

	// Whoever posted the role hears about it: the startup's contact for a
	// startup's role, the operating inbox for one of TIC's own.
	if (job.companyId) {
		const { data: company } = await supabaseAdmin
			.from('companies')
			.select('contact_name, contact_email, email')
			.eq('id', job.companyId)
			.maybeSingle();
		const to = (company?.contact_email as string) || (company?.email as string) || '';
		if (to) {
			await sendTemplateEmail({
				templateKey: 'new-role-applicant',
				to,
				toName: (company?.contact_name as string) ?? '',
				variables: {
					contactName: (company?.contact_name as string) ?? '',
					role: job.role,
					applicantName: fullName,
					applicantEmail: email,
					applicantRole
				},
				context: { table: 'job_applications', jobSlug: job.slug }
			});
		}
	} else {
		await sendTemplateEmail({
			templateKey: 'new-tic-role-applicant',
			to: adminAlertRecipient(),
			variables: { role: job.role, applicantName: fullName, applicantEmail: email, applicantRole },
			context: { table: 'job_applications', jobSlug: job.slug }
		});
	}

	return json({ ok: true }, { status: 201 });
};
