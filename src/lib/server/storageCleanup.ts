import { supabaseAdmin } from '$lib/server/supabaseAdmin';

// Deleting an auth user cascades through the tables — profiles, companies, jobs
// and applications all go with it — but a cascade knows nothing about storage.
// Nothing pointed at those objects any more, and nothing removed them either,
// so every deleted founder left their pitch deck and CV sitting in a private
// bucket indefinitely.
//
// Applications are keyed by user id, one folder each (see submitApplication), so
// the whole folder goes.

const APPLICATION_BUCKET = 'application-documents';
const PAGE = 100;

async function listFolder(bucket: string, prefix: string): Promise<string[]> {
	const paths: string[] = [];

	for (let offset = 0; ; offset += PAGE) {
		const { data, error } = await supabaseAdmin.storage
			.from(bucket)
			.list(prefix, { limit: PAGE, offset });

		if (error) {
			console.error(`[storage] could not list ${bucket}/${prefix}:`, error.message);
			return paths;
		}
		if (!data || data.length === 0) return paths;

		// A row with no id is a nested folder placeholder rather than an object.
		for (const entry of data) if (entry.id) paths.push(`${prefix}/${entry.name}`);
		if (data.length < PAGE) return paths;
	}
}

/**
 * Removes everything a user uploaded to the application bucket. Reports what it
 * did rather than throwing: an account deletion must still complete when the
 * storage API is having a bad day, and the caller logs the count.
 */
export async function removeApplicationDocuments(userId: string): Promise<number> {
	const paths = await listFolder(APPLICATION_BUCKET, userId);
	if (paths.length === 0) return 0;

	const { error } = await supabaseAdmin.storage.from(APPLICATION_BUCKET).remove(paths);
	if (error) {
		console.error(`[storage] could not remove documents for ${userId}:`, error.message);
		return 0;
	}
	return paths.length;
}
