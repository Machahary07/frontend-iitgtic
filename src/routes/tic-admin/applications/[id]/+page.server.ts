import { error } from '@sveltejs/kit';
import { adminDb } from '$lib/server/adminData';
import type { PageServerLoad } from './$types';

const BUCKET = 'application-documents';
const SIGNED_URL_TTL_SECONDS = 60 * 10;

type DocumentEntry = { path: string; name: string; size: number };

export const load: PageServerLoad = async ({ parent, params }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);

	const { data, error: dbError } = await db
		.from('applications')
		.select(
			'id, user_id, status, full_name, email, startup_name, applicant_message, review_note, reviewed_at, created_at, updated_at, answers, documents'
		)
		.eq('id', params.id)
		.maybeSingle();

	if (dbError) error(500, dbError.message);
	if (!data) error(404, 'Application not found.');

	const documents = (data.documents ?? {}) as Record<string, DocumentEntry>;
	const documentLinks: Record<string, { name: string; size: number; url: string | null }> = {};

	for (const [field, entry] of Object.entries(documents)) {
		if (!entry?.path) continue;
		const { data: signed } = await db.storage
			.from(BUCKET)
			.createSignedUrl(entry.path, SIGNED_URL_TTL_SECONDS);
		documentLinks[field] = { name: entry.name, size: entry.size, url: signed?.signedUrl ?? null };
	}

	return { application: data, documentLinks };
};
