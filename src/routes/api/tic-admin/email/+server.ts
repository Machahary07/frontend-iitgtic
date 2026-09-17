import { error, json } from '@sveltejs/kit';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import {
	emailConfig,
	invalidateEmailTemplates,
	resolveTemplate,
	sendTemplateEmail
} from '$lib/server/email';
import { sampleVariables, templateDef } from '$lib/utils/emailTemplates';
import { blockProblems, parseBlocks, renderBlocks } from '$lib/utils/emailBlocks';
import type { RequestHandler } from './$types';

// Templates and the log. Both tables are service-role only, so this is the only
// way the console reaches them.

const PAGE_SIZE = 25;

// Older log rows, for the "Load more" button. The first page comes from the
// page load; bodies are left out here because the list only shows metadata —
// a preview fetches the one row it needs through ?id=.
export const GET: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireAdmin(cookies);

	const id = url.searchParams.get('id');
	if (id) {
		const { data, error: dbError } = await ctx.db
			.from('email_log')
			.select('id, subject, body, to_email, to_name, status, created_at')
			.eq('id', id)
			.maybeSingle();
		if (dbError) error(500, dbError.message);
		if (!data) error(404, 'No such message.');
		return json({ message: data });
	}

	let query = ctx.db
		.from('email_log')
		.select(
			'id, template_key, to_email, to_name, subject, status, provider_id, error, is_test, context, created_at'
		)
		.order('created_at', { ascending: false })
		.limit(PAGE_SIZE);

	// No status filter here on purpose: the console filters the rows it has
	// loaded, so paging has to walk the whole log in order. Filtering here as
	// well would interleave a filtered page with an unfiltered one and leave
	// gaps in the list when the tab was switched back.
	const before = url.searchParams.get('before');
	if (before) query = query.lt('created_at', before);

	const { data, error: dbError } = await query;
	if (dbError) error(500, dbError.message);

	return json({ entries: data ?? [] });
};

// Save one template. The audit trigger on email_templates records the full
// before/after, so a bad edit is recoverable from Activity.
export const PUT: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);

	const payload = (await request.json().catch(() => ({}))) as {
		key?: string;
		subject?: string;
		body?: string;
		blocks?: unknown;
		enabled?: boolean;
	};
	if (!payload.key) error(400, 'Missing template key.');

	const def = templateDef(payload.key);
	if (!def) error(400, 'Unknown template.');
	if (!payload.subject?.trim()) error(400, 'The subject cannot be empty.');

	// A message composed from blocks is stored as both: the blocks are what the
	// editor reads back, and the body is compiled from them here rather than
	// taken from the request. The body is derived data, so letting a client post
	// it directly would be a way to put arbitrary markup in an outgoing email.
	let blocks = null;
	let bodyHtml: string;

	if (payload.blocks !== undefined && payload.blocks !== null) {
		blocks = parseBlocks(payload.blocks);
		if (!blocks) error(400, 'That message has no blocks the editor understands.');
		if (blocks.length === 0)
			error(400, 'A message needs at least one block before it can be saved.');

		const problems = blockProblems(blocks);
		if (problems.length > 0) error(400, problems[0]);

		bodyHtml = renderBlocks(blocks);
	} else {
		if (!payload.body?.trim()) error(400, 'The body cannot be empty.');
		bodyHtml = payload.body;
	}

	// The layout is what every other message renders into, so losing the slot
	// would silently blank every send rather than break just this template.
	if (payload.key === 'layout' && !bodyHtml.includes('{{{content}}}')) {
		error(400, 'The layout must keep {{{content}}} — that is where each message is placed.');
	}

	const { error: dbError } = await ctx.db.from('email_templates').upsert(
		{
			key: payload.key,
			subject: payload.subject.trim(),
			body: bodyHtml,
			blocks,
			enabled: payload.enabled ?? true,
			updated_by: ctx.admin.userId,
			updated_at: new Date().toISOString()
		},
		{ onConflict: 'key' }
	);
	if (dbError) error(500, dbError.message);

	invalidateEmailTemplates();
	await logAdminAction(ctx, `edited email template · ${payload.key}`, {
		table: 'email_templates',
		recordId: payload.key
	});

	return json({ ok: true });
};

// Restores a template to the copy bundled in emailTemplates.ts.
export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireAdmin(cookies);
	const key = url.searchParams.get('key');
	if (!key) error(400, 'Missing template key.');
	if (!templateDef(key)) error(400, 'Unknown template.');

	const { error: dbError } = await ctx.db.from('email_templates').delete().eq('key', key);
	if (dbError) error(500, dbError.message);

	invalidateEmailTemplates();
	await logAdminAction(ctx, `reset email template to the bundled default · ${key}`, {
		table: 'email_templates',
		recordId: key
	});

	return json({ ok: true });
};

// Send a test. It goes to the signed-in admin's own address unless another is
// given, uses the sample values from the template definition, and is tagged
// is_test so it is filtered out of the log by default.
export const POST: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);

	const body = (await request.json().catch(() => ({}))) as { key?: string; to?: string };
	if (!body.key) error(400, 'Missing template key.');

	const def = templateDef(body.key);
	if (!def) error(400, 'Unknown template.');
	if (def.key === 'layout') error(400, 'The layout has no message of its own to send.');

	const config = emailConfig();
	if (!config.configured) error(400, 'RESEND_API_KEY is not set, so no test can be sent.');

	const to = body.to?.trim() || ctx.admin.email;
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) error(400, 'That is not a valid email address.');

	// Saved-but-disabled templates are still testable — seeing one before it goes
	// live is the point of a test.
	const template = await resolveTemplate(def.key);
	const result = await sendTemplateEmail({
		templateKey: def.key,
		to,
		variables: sampleVariables(def),
		context: { test: true, enabled: template?.enabled ?? true },
		sentBy: ctx.admin.userId,
		isTest: true,
		ignoreEnabled: true
	});

	await logAdminAction(ctx, `sent a test email · ${def.key} → ${to}`, {
		table: 'email_log',
		recordId: def.key
	});

	if (!result.ok) error(502, result.error ?? 'The provider rejected the message.');
	return json({ ok: true, to, id: result.id });
};
