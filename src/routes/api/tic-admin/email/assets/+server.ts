import { error, json } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import type { RequestHandler } from './$types';

// Uploads for the picture and file blocks. The bucket is public because an email
// client fetches an image with no credentials — see the migration for why that
// is the only workable choice. Writing is admin-only, which is what keeps the
// bucket to what the console published.

const BUCKET = 'email-assets';
const MAX_BYTES = 5 * 1024 * 1024;

const TYPES: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/svg+xml': 'svg',
	'application/pdf': 'pdf',
	'application/msword': 'doc',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
	'text/plain': 'txt',
	'text/csv': 'csv'
};

function humanSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const POST: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);

	const form = await request.formData().catch(() => null);
	const file = form?.get('file');
	if (!(file instanceof File) || file.size === 0) error(400, 'No file was uploaded.');
	if (file.size > MAX_BYTES) error(400, 'That file is larger than 5 MB.');

	const extension = TYPES[file.type];
	if (!extension)
		error(400, 'That file type cannot go in an email. Use an image, a PDF or a Word document.');

	// Prefixed with the time so re-uploading a file under the same name does not
	// silently replace the one an already-delivered email is pointing at.
	const safeName = file.name
		.replace(/\.[^.]*$/, '')
		.replace(/[^A-Za-z0-9._-]+/g, '-')
		.slice(0, 60);
	const path = `${Date.now()}-${safeName || 'file'}.${extension}`;

	const { error: uploadError } = await supabaseAdmin.storage
		.from(BUCKET)
		.upload(path, file, { contentType: file.type, cacheControl: '31536000' });
	if (uploadError) error(500, uploadError.message);

	await logAdminAction(ctx, `uploaded an email asset · ${path}`, { table: 'storage.objects' });

	return json({
		url: `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`,
		name: file.name,
		size: humanSize(file.size)
	});
};
