import { error, json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/adminGuard';
import type { RequestHandler } from './$types';

// The assistant's saved chats. One row per conversation in assistant_conversations,
// always scoped to the admin who owns it — the table is service-role only, so
// every query here carries the admin id itself rather than leaning on RLS.

const LIST_LIMIT = 50;
const TITLE_MAX = 120;

// A stored message is the reply as it was rendered, minus the transient bits
// (streaming/error). Kept deliberately small so a long history is cheap to hold.
type StoredMessage = {
	role: 'you' | 'assistant';
	text: string;
	images?: string[];
	steps?: string[];
	reasoning?: string;
};

function cleanMessages(value: unknown): StoredMessage[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === 'object')
		.map((m) => ({
			role: m.role === 'assistant' ? 'assistant' : 'you',
			text: typeof m.text === 'string' ? m.text : '',
			images: Array.isArray(m.images) ? (m.images as string[]) : [],
			steps: Array.isArray(m.steps) ? (m.steps as string[]) : [],
			reasoning: typeof m.reasoning === 'string' ? m.reasoning : ''
		}));
}

// List the admin's conversations, or return one in full with ?id=.
export const GET: RequestHandler = async ({ cookies, url }) => {
	const ctx = requireAdmin(cookies);
	const id = url.searchParams.get('id');

	if (id) {
		const { data, error: dbError } = await ctx.db
			.from('assistant_conversations')
			.select('id, title, messages, updated_at')
			.eq('id', id)
			.eq('admin_id', ctx.admin.userId)
			.maybeSingle();
		if (dbError) error(500, dbError.message);
		if (!data) error(404, 'No such conversation.');
		return json({ conversation: data });
	}

	const { data, error: dbError } = await ctx.db
		.from('assistant_conversations')
		.select('id, title, updated_at')
		.eq('admin_id', ctx.admin.userId)
		.order('updated_at', { ascending: false })
		.limit(LIST_LIMIT);
	if (dbError) error(500, dbError.message);

	return json({ conversations: data ?? [] });
};

// Save a conversation. With an id it updates that row (only if the admin owns
// it); without one it creates a new conversation and returns its id, which the
// console then reuses for every later autosave of the same chat.
export const PUT: RequestHandler = async ({ cookies, request }) => {
	const ctx = requireAdmin(cookies);

	const body = (await request.json().catch(() => ({}))) as {
		id?: string;
		title?: string;
		messages?: unknown;
	};

	const title = (body.title?.trim() || 'New chat').slice(0, TITLE_MAX);
	const messages = cleanMessages(body.messages);

	if (body.id) {
		const { data, error: dbError } = await ctx.db
			.from('assistant_conversations')
			.update({ title, messages })
			.eq('id', body.id)
			.eq('admin_id', ctx.admin.userId)
			.select('id')
			.maybeSingle();
		if (dbError) error(500, dbError.message);
		if (data) return json({ id: data.id });
		// The id was unknown or belonged to someone else — fall through and make a
		// fresh row rather than silently dropping the save.
	}

	const { data, error: dbError } = await ctx.db
		.from('assistant_conversations')
		.insert({ admin_id: ctx.admin.userId, title, messages })
		.select('id')
		.single();
	if (dbError) error(500, dbError.message);

	return json({ id: data.id });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = requireAdmin(cookies);
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing conversation id.');

	const { error: dbError } = await ctx.db
		.from('assistant_conversations')
		.delete()
		.eq('id', id)
		.eq('admin_id', ctx.admin.userId);
	if (dbError) error(500, dbError.message);

	return json({ ok: true });
};
