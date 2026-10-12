// The 8-step incubation application. The answers go into public.applications as
// jsonb; the four attachments go into the private `application-documents`
// storage bucket, one folder per user, and the row records their paths.

import { supabase } from '$lib/supabaseClient';
import {
	DOCUMENT_FIELDS,
	missingRequiredAnswers,
	type DocumentField
} from '$lib/utils/applicationSchema';

export type ApplicationDocuments = Record<string, { path: string; name: string; size: number }>;

/** An application TIC sent back, reopened in the form with everything kept. */
export type ReturnedApplication = {
	id: string;
	answers: Record<string, unknown>;
	documents: ApplicationDocuments;
	note: string | null;
	returnedAt: string | null;
};

export type SubmitResult = { ok: true; id: string } | { ok: false; error: string };

export { DOCUMENT_FIELDS, type DocumentField };

export async function submitApplication(
	answers: Record<string, unknown>,
	files: Partial<Record<DocumentField, File | null>>,
	// Which startup this application is for. A founder may run several, and each
	// one applies on its own, so the row carries the company rather than only the
	// person who typed it.
	companyId: string | null
): Promise<SubmitResult> {
	const { data: sessionData } = await supabase.auth.getSession();
	const userId = sessionData.session?.user.id;
	if (!userId) {
		return { ok: false, error: 'Please sign in before submitting your application.' };
	}
	if (!companyId) {
		return { ok: false, error: 'Choose which startup this application is for.' };
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

	const uploaded = await uploadDocuments(userId, files);
	if (!uploaded.ok) return uploaded;
	const documents = uploaded.documents;

	// The File objects themselves are not serialisable — only their paths are stored.
	const payload = { ...answers };
	for (const field of DOCUMENT_FIELDS) delete payload[field];

	const { data, error } = await supabase
		.from('applications')
		.insert({
			user_id: userId,
			company_id: companyId,
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

async function uploadDocuments(
	userId: string,
	files: Partial<Record<DocumentField, File | null>>
): Promise<{ ok: true; documents: ApplicationDocuments } | { ok: false; error: string }> {
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
	return { ok: true, documents };
}

// Submits an application TIC sent back. Only newly chosen files are uploaded;
// the rest keep the uploads already on the row. The status change happens on
// the server, which a founder cannot write directly.
export async function resubmitApplication(
	id: string,
	answers: Record<string, unknown>,
	files: Partial<Record<DocumentField, File | null>>,
	kept: ApplicationDocuments
): Promise<SubmitResult> {
	const { data: sessionData } = await supabase.auth.getSession();
	const userId = sessionData.session?.user.id;
	if (!userId) {
		return { ok: false, error: 'Please sign in before submitting your application.' };
	}

	const missing = missingRequiredAnswers(answers);
	if (missing.length > 0) {
		return {
			ok: false,
			error: `Please complete every required field before submitting: ${missing.join(', ')}.`
		};
	}
	if (!files.pitchDeck && !kept.pitchDeck) {
		return { ok: false, error: 'A pitch deck PDF is required before submitting.' };
	}

	const uploaded = await uploadDocuments(userId, files);
	if (!uploaded.ok) return uploaded;

	const payload = { ...answers };
	for (const field of DOCUMENT_FIELDS) delete payload[field];

	const res = await fetch('/api/founder/application/resubmit', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ id, answers: payload, documents: { ...kept, ...uploaded.documents } })
	}).catch(() => null);
	if (!res) return { ok: false, error: 'Could not reach the server. Please try again.' };

	const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
	if (!res.ok) return { ok: false, error: body.message ?? body.error ?? 'Could not submit.' };
	return { ok: true, id };
}

export type ApplicationStatus = 'submitted' | 'under-review' | 'accepted' | 'rejected' | 'returned';

export type MyApplication = {
	id: string;
	status: ApplicationStatus;
	startup_name: string;
	created_at: string;
	reviewed_at: string | null;
	applicant_message: string | null;
};

// The applicant's own applications, newest first. RLS ("applications: read mine")
// scopes this to the signed-in user and the startups they work for, so no filter
// is needed here — the select would return nothing for anyone else regardless. review_note is the
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
