import { error, json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/adminGuard';
import { findTool, toolAllowed } from '$lib/server/assistantTools';
import type { RequestHandler } from './$types';

// Applies a change the assistant proposed and the admin approved.
//
// In manual-approval mode the assistant loop only previews a write — it never
// touches the database. The write happens here, when the admin clicks Approve,
// and it runs the very same tool the loop would have run. So the merge, the
// audit entry and the cache invalidation are single-sourced with the
// auto-approve path; approval only decides *when* the tool runs, not how.

export const POST: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);

	const body = (await request.json().catch(() => ({}))) as {
		tool?: string;
		args?: Record<string, unknown>;
	};

	const tool = body.tool ? findTool(body.tool) : undefined;
	// Only write tools are approvable, and nothing else may be driven from here.
	if (!tool?.write) error(400, 'That is not an approvable change.');
	if (!toolAllowed(ctx.admin.role, tool.name)) error(403, 'Your role cannot make this change.');

	const result = (await tool.run(ctx.db, body.args ?? {}, ctx)) as Record<string, unknown>;
	if (result && typeof result === 'object' && 'error' in result) {
		error(400, String(result.error));
	}

	return json({ ok: true, result });
};
