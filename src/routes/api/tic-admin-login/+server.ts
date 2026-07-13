import { json } from '@sveltejs/kit';
import { TIC_ADMIN_PASSWORD } from '$env/static/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { password } = (await request.json().catch(() => ({}))) as { password?: string };
	return json({ ok: typeof password === 'string' && password === TIC_ADMIN_PASSWORD });
};
