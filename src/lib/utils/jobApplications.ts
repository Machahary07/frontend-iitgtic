// Applying to a role on the Opportunities board.
//
// The applicant is a visitor, not an account, so the submission cannot go to
// Supabase directly — public.job_applications is service-role only. It posts to
// /api/job-applications instead, which re-verifies the Turnstile token, stores
// the resume in the private `job-applications` bucket and writes the row.
//
// The limits below are shared with that route so the browser and the server
// agree on what a valid application is.

export const WHY_MIN = 40;
export const WHY_MAX = 800;
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The bucket only accepts these three types, and a .doc can arrive from the
// browser as application/octet-stream — so the content type is decided by the
// extension here rather than taken from the File.
export const RESUME_TYPES: Record<string, string> = {
	'.pdf': 'application/pdf',
	'.doc': 'application/msword',
	'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

export const RESUME_ACCEPT = Object.keys(RESUME_TYPES).join(',');

export function resumeExtension(fileName: string): string | null {
	const match = /\.[a-z0-9]+$/i.exec(fileName.trim());
	const ext = match?.[0].toLowerCase() ?? null;
	return ext && ext in RESUME_TYPES ? ext : null;
}

export type JobApplicationInput = {
	jobSlug: string;
	fullName: string;
	email: string;
	phone: string;
	applicantRole: string;
	portfolioLink: string;
	why: string;
	startDate: string;
	onsiteOk: boolean;
	consent: boolean;
	resume: File;
	turnstileToken: string;
};

export type SubmitResult = { ok: true } | { ok: false; error: string };

export async function submitJobApplication(input: JobApplicationInput): Promise<SubmitResult> {
	const form = new FormData();
	form.set('jobSlug', input.jobSlug);
	form.set('fullName', input.fullName);
	form.set('email', input.email);
	form.set('phone', input.phone);
	form.set('applicantRole', input.applicantRole);
	form.set('portfolioLink', input.portfolioLink);
	form.set('why', input.why);
	form.set('startDate', input.startDate);
	form.set('onsiteOk', String(input.onsiteOk));
	form.set('consent', String(input.consent));
	form.set('token', input.turnstileToken);
	form.set('resume', input.resume);

	try {
		const res = await fetch('/api/job-applications', { method: 'POST', body: form });
		if (res.ok) return { ok: true };

		const body = (await res.json().catch(() => ({}))) as { message?: string };
		return {
			ok: false,
			error: body.message ?? 'Could not send your application. Please try again.'
		};
	} catch {
		return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
	}
}
