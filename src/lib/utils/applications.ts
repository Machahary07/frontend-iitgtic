// The 8-step incubation application. The answers go into public.applications as
// jsonb; the four attachments go into the private `application-documents`
// storage bucket, one folder per user, and the row records their paths.

import { supabase } from '$lib/supabaseClient';
import { missingRequiredAnswers } from '$lib/utils/applicationSchema';

export type ApplicationDocuments = Record<string, { path: string; name: string; size: number }>;

export type SubmitResult = { ok: true; id: string } | { ok: false; error: string };

const DOCUMENT_FIELDS = [
	'pitchDeck',
	'founderCv',
	'financialProjections',
	'incorporationCert'
] as const;

export type DocumentField = (typeof DOCUMENT_FIELDS)[number];

export async function submitApplication(
	answers: Record<string, unknown>,
	files: Partial<Record<DocumentField, File | null>>
): Promise<SubmitResult> {
	const { data: sessionData } = await supabase.auth.getSession();
	const userId = sessionData.session?.user.id;
	if (!userId) {
		return { ok: false, error: 'Please sign in before submitting your application.' };
	}

	// Second gate behind the form's own step validation. Checked before anything is
	// uploaded, so an incomplete application never leaves files behind in storage.
	const missing = missingRequiredAnswers(answers);
	if (missing.length > 0) {
		return {
			ok: false,
			error: `Please complete every required field before submitting: ${missing.join(', ')}.`
		};
	}
	if (!files.pitchDeck) {
		return { ok: false, error: 'A pitch deck PDF is required before submitting.' };
	}

	const documents: ApplicationDocuments = {};
	const stamp = Date.now();

	for (const field of DOCUMENT_FIELDS) {
		const file = files[field];
		if (!file) continue;

		const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '-');
		const path = `${userId}/${stamp}-${field}-${safeName}`;
		const { error } = await supabase.storage
			.from('application-documents')
			.upload(path, file, { upsert: true, contentType: file.type || undefined });

		if (error) {
			return { ok: false, error: `Could not upload ${file.name}: ${error.message}` };
		}
		documents[field] = { path, name: file.name, size: file.size };
	}

	// The File objects themselves are not serialisable — only their paths are stored.
	const payload = { ...answers };
	for (const field of DOCUMENT_FIELDS) delete payload[field];

	const { data, error } = await supabase
		.from('applications')
		.insert({
			user_id: userId,
			full_name: String(answers.fullName ?? ''),
			email: String(answers.email ?? ''),
			startup_name: String(answers.startupName ?? ''),
			answers: payload,
			documents
		})
		.select('id')
		.single();

	if (error) return { ok: false, error: error.message };
	return { ok: true, id: data.id as string };
}

export type ApplicationStatus = 'submitted' | 'under-review' | 'accepted' | 'rejected';

export type MyApplication = {
	id: string;
	status: ApplicationStatus;
	startup_name: string;
	created_at: string;
	reviewed_at: string | null;
	applicant_message: string | null;
};

// The applicant's own applications, newest first. RLS ("applications: read own")
// scopes this to the signed-in user, so no user_id filter is needed here — the
// select would return nothing for anyone else regardless. review_note is the
// team's private note and is not selectable by a founder; applicant_message is
// the line written for them.
export async function getMyApplications(): Promise<MyApplication[]> {
	const { data, error } = await supabase
		.from('applications')
		.select('id, status, startup_name, created_at, reviewed_at, applicant_message')
		.order('created_at', { ascending: false });

	if (error) return [];
	return (data ?? []) as MyApplication[];
}

export type ApplicationDetail = MyApplication & {
	full_name: string;
	email: string;
	answers: Record<string, unknown>;
	documents: Record<string, { path: string; name: string; size: number }>;
};

// One application in full, for the founder's own detail view. Same "read own" RLS
// as above, so a bad or someone else's id simply resolves to null.
export async function getApplication(id: string): Promise<ApplicationDetail | null> {
	const { data, error } = await supabase
		.from('applications')
		.select(
			'id, status, startup_name, created_at, reviewed_at, applicant_message, full_name, email, answers, documents'
		)
		.eq('id', id)
		.maybeSingle();

	if (error || !data) return null;
	return data as ApplicationDetail;
}

// A short-lived link to one of the founder's own uploaded documents. The
// "application docs: read own" storage policy scopes this to their own folder,
// so it can be signed straight from the browser without a server route.
export async function signMyDocument(path: string, ttlSeconds = 600): Promise<string | null> {
	const { data } = await supabase.storage
		.from('application-documents')
		.createSignedUrl(path, ttlSeconds);
	return data?.signedUrl ?? null;
}

// Asks the server to send the "application received" email. Best-effort: the
// submit already succeeded, so a mail hiccup must not surface as an error. The
// server re-checks the session and that the application belongs to the caller.
export async function notifyApplicationSubmitted(applicationId: string): Promise<void> {
	try {
		const { data } = await supabase.auth.getSession();
		const token = data.session?.access_token;
		if (!token) return;
		await fetch('/api/application-submitted', {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
			body: JSON.stringify({ applicationId })
		});
	} catch {
		// Network error on a courtesy email — nothing to do.
	}
}
