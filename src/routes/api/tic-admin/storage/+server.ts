import { error, json } from '@sveltejs/kit';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import { objectIsReferenced } from '$lib/server/storageUsage';
import type { RequestHandler } from './$types';

// Reading and removing single objects for the Storage console. Listing happens
// in the page's own load; this is the part that has to be a route, because it
// either mutates or hands out a credential.

// Matches the TTL the application and applicant screens already use for the
// private buckets: long enough to open the file, short enough that a copied
// link is not a lasting handout.
const SIGNED_URL_SECONDS = 600;

/** A short-lived link to one object in a private bucket, for preview or download. */
export const GET: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireAdmin(cookies);

	const bucket = url.searchParams.get('bucket');
	const path = url.searchParams.get('path');
	if (!bucket || !path) error(400, 'A bucket and a path are required.');

	const { data, error: signError } = await ctx.db.storage
		.from(bucket)
		.createSignedUrl(path, SIGNED_URL_SECONDS);

	if (signError || !data) error(404, signError?.message ?? 'No such object.');

	return json({ url: data.signedUrl, expiresIn: SIGNED_URL_SECONDS });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireAdmin(cookies);

	const bucket = url.searchParams.get('bucket');
	const path = url.searchParams.get('path');
	if (!bucket || !path) error(400, 'A bucket and a path are required.');

	// A file the site is still showing is refused by default. The console asks a
	// second, blunter question and retries with force, so removing something in
	// use stays possible but never accidental.
	const force = url.searchParams.get('force') === '1';
	if (!force && (await objectIsReferenced(ctx.db, path))) {
		error(409, 'Something on the site still points at this file.');
	}

	const { error: removeError } = await ctx.db.storage.from(bucket).remove([path]);
	if (removeError) error(500, removeError.message);

	await logAdminAction(ctx, `deleted a stored file · ${bucket}/${path}`, {
		table: 'storage.objects'
	});

	return json({ ok: true });
};
