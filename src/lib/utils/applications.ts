// The 8-step incubation application. The answers go into public.applications as
// jsonb; the four attachments go into the private `application-documents`
// storage bucket, one folder per user, and the row records their paths.

import { supabase } from '$lib/supabaseClient';

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

export async function getMyApplications() {
	const { data, error } = await supabase
		.from('applications')
		.select('id, status, startup_name, created_at')
		.order('created_at', { ascending: false });

	if (error) return [];
	return data ?? [];
}
