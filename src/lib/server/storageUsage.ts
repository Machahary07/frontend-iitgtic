import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

// What the Storage console reads. Supabase keeps files in S3 and only their
// metadata in Postgres, so none of this is answerable with a query — every
// figure below comes from walking the buckets through the storage API.

const PAGE = 100;

// Folders nest (one per user in application-documents, one per role in
// job-applications). The walk is bounded so a pathological tree cannot turn a
// page load into thousands of round trips.
const MAX_DEPTH = 4;

// Supabase does not report a plan's storage allowance over the API, so the
// ceiling this meter draws against is configuration, not a lookup. One gigabyte
// is the free plan's allowance and the honest default: a meter that under-states
// headroom nags early, one that over-states it goes quiet exactly when it
// should not. Set SUPABASE_STORAGE_QUOTA_BYTES when the plan changes.
const DEFAULT_QUOTA = 1024 ** 3;

export function storageQuotaBytes(): number {
	const raw = Number(env.SUPABASE_STORAGE_QUOTA_BYTES);
	return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_QUOTA;
}

export type StoredObject = {
	bucket: string;
	/** Path inside the bucket, which is what the delete and sign routes take. */
	path: string;
	name: string;
	folder: string;
	size: number;
	mimeType: string;
	updatedAt: string;
	isImage: boolean;
	/** Public buckets can be shown straight away; private ones are signed on demand. */
	url: string | null;
	/** Whether anything in site content or an email template still points at it. */
	referenced: boolean;
};

export type BucketUsage = {
	id: string;
	public: boolean;
	fileSizeLimit: number | null;
	allowedMimeTypes: string[] | null;
	objects: number;
	bytes: number;
};

export type StorageSnapshot = {
	buckets: BucketUsage[];
	objects: StoredObject[];
	totalBytes: number;
	totalObjects: number;
	quotaBytes: number;
	/** Set when the storage API failed, so the page can say so instead of showing zero. */
	problem: string | null;
};

function publicUrl(bucket: string, path: string): string {
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

async function walk(
	db: SupabaseClient,
	bucket: string,
	prefix: string,
	depth: number
): Promise<{ path: string; size: number; mimeType: string; updatedAt: string }[]> {
	if (depth > MAX_DEPTH) return [];
	const found: { path: string; size: number; mimeType: string; updatedAt: string }[] = [];

	for (let offset = 0; ; offset += PAGE) {
		const { data, error } = await db.storage.from(bucket).list(prefix, { limit: PAGE, offset });
		if (error || !data || data.length === 0) return found;

		for (const entry of data) {
			const path = prefix ? `${prefix}/${entry.name}` : entry.name;
			if (entry.id) {
				const meta = (entry.metadata ?? {}) as { size?: number; mimetype?: string };
				found.push({
					path,
					size: meta.size ?? 0,
					mimeType: meta.mimetype ?? 'application/octet-stream',
					updatedAt: entry.updated_at ?? entry.created_at ?? ''
				});
			} else {
				// A row with no id is a nested folder placeholder, not an object.
				found.push(...(await walk(db, bucket, path, depth + 1)));
			}
		}

		if (data.length < PAGE) return found;
	}
}

// Everything that could still be pointing at a stored file. Each source is read
// as raw text rather than walked field by field, because a reference can sit at
// any depth of a jsonb column and the only thing that matters is whether the
// path appears in it.
//
// The private buckets matter most here. A resume is referenced from
// job_applications.resume and a pitch deck from applications.documents, not from
// any content section — leave those two out and every document belonging to a
// real person is labelled "Unused", which is an invitation to delete it.
async function referenceHaystack(db: SupabaseClient): Promise<string> {
	const [content, templates, applications, jobApplications] = await Promise.all([
		db.from('site_content').select('value'),
		db.from('email_templates').select('*'),
		db.from('applications').select('documents'),
		db.from('job_applications').select('resume')
	]);

	const parts: string[] = [];
	for (const row of content.data ?? []) parts.push(JSON.stringify(row.value));
	for (const row of templates.data ?? []) parts.push(JSON.stringify(row));
	for (const row of applications.data ?? []) parts.push(JSON.stringify(row.documents));
	for (const row of jobApplications.data ?? []) parts.push(JSON.stringify(row.resume));
	return parts.join('\n');
}

export async function readStorage(db: SupabaseClient): Promise<StorageSnapshot> {
	const quotaBytes = storageQuotaBytes();

	const { data: bucketRows, error } = await db.storage.listBuckets();
	if (error || !bucketRows) {
		return {
			buckets: [],
			objects: [],
			totalBytes: 0,
			totalObjects: 0,
			quotaBytes,
			problem: error?.message ?? 'The storage API did not answer.'
		};
	}

	const haystack = await referenceHaystack(db);

	const buckets: BucketUsage[] = [];
	const objects: StoredObject[] = [];

	for (const bucket of bucketRows) {
		const entries = await walk(db, bucket.id, '', 0);
		let bytes = 0;

		for (const entry of entries) {
			bytes += entry.size;
			const slash = entry.path.lastIndexOf('/');
			objects.push({
				bucket: bucket.id,
				path: entry.path,
				name: slash === -1 ? entry.path : entry.path.slice(slash + 1),
				folder: slash === -1 ? '' : entry.path.slice(0, slash),
				size: entry.size,
				mimeType: entry.mimeType,
				updatedAt: entry.updatedAt,
				isImage: entry.mimeType.startsWith('image/'),
				url: bucket.public ? publicUrl(bucket.id, entry.path) : null,
				referenced: haystack.includes(entry.path)
			});
		}

		buckets.push({
			id: bucket.id,
			public: bucket.public,
			fileSizeLimit: bucket.file_size_limit ?? null,
			allowedMimeTypes: bucket.allowed_mime_types ?? null,
			objects: entries.length,
			bytes
		});
	}

	objects.sort((a, b) => b.size - a.size);

	return {
		buckets,
		objects,
		totalBytes: buckets.reduce((sum, b) => sum + b.bytes, 0),
		totalObjects: buckets.reduce((sum, b) => sum + b.objects, 0),
		quotaBytes,
		problem: null
	};
}

/**
 * Whether a single object is still pointed at by content or an email template.
 * Used by the delete route, which refuses to remove a file the site is showing
 * unless the caller insists — a broken image on a public page is a worse
 * outcome than a stray file in a bucket.
 */
export async function objectIsReferenced(db: SupabaseClient, path: string): Promise<boolean> {
	return (await referenceHaystack(db)).includes(path);
}
