import { error } from '@sveltejs/kit';
import { adminDb } from '$lib/server/adminData';
import type { PageServerLoad } from './$types';

const BUCKET = 'job-applications';
const SIGNED_URL_TTL_SECONDS = 60 * 10;

export const load: PageServerLoad = async ({ parent, params }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);

	const { data, error: dbError } = await db
		.from('job_applications')
		.select('*')
		.eq('id', params.id)
		.maybeSingle();

	if (dbError) error(500, dbError.message);
	if (!data) error(404, 'Application not found.');

	// The bucket is private. The reviewer gets a link that expires in ten
	// minutes rather than anything that could be forwarded on.
	const resume = (data.resume ?? {}) as { path?: string; name?: string; size?: number };
	let resumeUrl: string | null = null;
	if (resume.path) {
		const { data: signed } = await db.storage
			.from(BUCKET)
			.createSignedUrl(resume.path, SIGNED_URL_TTL_SECONDS);
		resumeUrl = signed?.signedUrl ?? null;
	}

	return { application: data, resumeUrl };
};
