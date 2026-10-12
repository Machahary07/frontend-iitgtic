import { error } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';

// Images for a startup's public profile, in the public site-assets bucket under
// startups/<profile id>/. Raster only: an SVG served from a public bucket can
// carry script, and these come from founders, not the console.

const BUCKET = 'site-assets';
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export async function uploadProfileImage(profileId: string, file: unknown): Promise<string> {
	if (!(file instanceof File) || file.size === 0) error(400, 'No file was uploaded.');
	if (file.size > MAX_BYTES) error(400, 'That image is larger than 5 MB.');
	const extension = TYPES[file.type];
	if (!extension) error(400, 'Use a PNG, JPEG or WebP image.');

	const safeName =
		file.name
			.replace(/\.[^.]*$/, '')
			.replace(/[^A-Za-z0-9._-]+/g, '-')
			.slice(0, 40) || 'image';
	const path = `startups/${profileId}/${Date.now()}-${safeName}.${extension}`;
	const { error: uploadError } = await supabaseAdmin.storage
		.from(BUCKET)
		.upload(path, file, { contentType: file.type, cacheControl: '31536000' });
	if (uploadError) error(500, uploadError.message);
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
