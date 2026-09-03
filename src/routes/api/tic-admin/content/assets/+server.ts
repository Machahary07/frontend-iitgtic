import { error, json } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import type { RequestHandler } from './$types';

// Uploads for a media field in the content editor — a logo, a photo, and later
// a video. The bucket is public because a visitor's browser fetches an <img>
// with no credentials; writing is admin-only, which keeps the bucket to what
// the console published. Mirrors /api/tic-admin/email/assets.

const BUCKET = 'site-assets';
const MAX_BYTES = 5 * 1024 * 1024;

const TYPES: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/svg+xml': 'svg'
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	const ctx = requireAdmin(cookies);

	const form = await request.formData().catch(() => null);
	const file = form?.get('file');
	if (!(file instanceof File) || file.size === 0) error(400, 'No file was uploaded.');
	if (file.size > MAX_BYTES) error(400, 'That file is larger than 5 MB.');

	const extension = TYPES[file.type];
	if (!extension) error(400, 'That file type is not supported. Use a PNG, JPEG, WebP, GIF or SVG.');

	// Prefixed with the time so re-uploading a file under the same name does not
	// silently replace one that a saved section is already pointing at.
	const safeName = file.name
		.replace(/\.[^.]*$/, '')
		.replace(/[^A-Za-z0-9._-]+/g, '-')
		.slice(0, 60);
	const path = `${Date.now()}-${safeName || 'image'}.${extension}`;

	const { error: uploadError } = await supabaseAdmin.storage
		.from(BUCKET)
		.upload(path, file, { contentType: file.type, cacheControl: '31536000' });
	if (uploadError) error(500, uploadError.message);

	await logAdminAction(ctx, `uploaded a site asset · ${path}`, { table: 'storage.objects' });

	return json({
		url: `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`,
		name: file.name
	});
};
