import { error } from '@sveltejs/kit';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { validatedAdminSession, type ConsoleSession } from '$lib/server/sessionValidation';
import { roleLabel } from '$lib/utils/roles';
import type { Cookies } from '@sveltejs/kit';

// Every admin route starts here: it proves the caller is a signed-in admin and
// hands back a service-role client tagged with that admin's id. The tag travels
// as an x-actor-id header, which the audit trigger reads through PostgREST's
// request.headers setting — so a row changed by an admin route is attributed to
// the person who clicked, not to "service role".

export type AdminContext = {
	admin: ConsoleSession;
	db: SupabaseClient;
};

// While a developer views as someone, the change is still theirs: the audit
// trail names the person at the keyboard, not the account on screen.
export function actorId(admin: Pick<ConsoleSession, 'userId' | 'actor'>): string {
	return admin.actor?.userId ?? admin.userId;
}

export function actorLabel(admin: ConsoleSession): string {
	const who = `${admin.name || admin.email} (${roleLabel(admin.role)})`;
	if (!admin.actor) return who;
	return `${admin.actor.name || admin.actor.email} (${roleLabel(admin.actor.role)}, viewing as ${who})`;
}

export async function requireAdmin(cookies: Cookies): Promise<AdminContext> {
	const admin = await validatedAdminSession(cookies);
	if (!admin) error(401, 'Not signed in as a TIC admin.');

	const db: SupabaseClient = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
		global: { headers: { 'x-actor-id': actorId(admin) } }
	});

	return { admin, db };
}

// High-level intent, recorded alongside the automatic row-level trigger entries.
// "verified Northeast Robotics" is easier to read back than "update companies".
export async function logAdminAction(
	ctx: AdminContext,
	action: string,
	details: { table?: string; recordId?: string; after?: unknown } = {}
): Promise<void> {
	await ctx.db.from('audit_log').insert({
		source: 'app',
		actor_id: actorId(ctx.admin),
		actor_label: actorLabel(ctx.admin),
		action,
		table_name: details.table ?? null,
		record_id: details.recordId ?? null,
		after: details.after ?? null
	});
}
