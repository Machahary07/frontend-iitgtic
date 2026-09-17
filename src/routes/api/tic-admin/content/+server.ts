import { error, json } from '@sveltejs/kit';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import { invalidateSiteContent } from '$lib/server/siteContent';
import type { RequestHandler } from './$types';

// Saves one content section. The audit trigger on site_content records the full
// before/after, so a bad edit can be seen — and read back — from Activity.

export const PUT: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);

	const body = (await request.json().catch(() => ({}))) as {
		key?: string;
		value?: unknown;
		label?: string;
	};
	if (!body.key) error(400, 'Missing section key.');
	if (body.value === undefined) error(400, 'Missing value.');

	const { error: dbError } = await ctx.db.from('site_content').upsert(
		{
			key: body.key,
			value: body.value,
			label: body.label ?? '',
			updated_by: ctx.admin.userId,
			updated_at: new Date().toISOString()
		},
		{ onConflict: 'key' }
	);
	if (dbError) error(500, dbError.message);

	// The public site reads through an in-process cache; without this the edit
	// would not show until the TTL lapsed.
	invalidateSiteContent();

	await logAdminAction(ctx, `edited site content · ${body.key}`, {
		table: 'site_content',
		recordId: body.key
	});

	return json({ ok: true });
};

// Restores a section to the copy bundled in content.json.
export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireAdmin(cookies);
	const key = url.searchParams.get('key');
	if (!key) error(400, 'Missing section key.');

	const { error: dbError } = await ctx.db.from('site_content').delete().eq('key', key);
	if (dbError) error(500, dbError.message);

	invalidateSiteContent();
	await logAdminAction(ctx, `reset site content to the bundled default · ${key}`, {
		table: 'site_content',
		recordId: key
	});

	return json({ ok: true });
};
