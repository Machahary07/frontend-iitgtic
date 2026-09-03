import { createHash, timingSafeEqual } from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import { TIC_ADMIN_PASSWORD } from '$env/static/private';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import {
	clearTicAdminSession,
	issueTicAdminSession,
	readTicAdminSession
} from '$lib/server/ticAdminSession';
import { LIMITS, retryMinutes, withinLimit } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';

// GET     current session, plus whether the console still needs its first admin
// POST    { accessToken }                       sign in as an existing admin
// POST    { bootstrapPassword, email, password } create the first admin, once
// DELETE  sign out

// Compared through a digest so the two buffers are always the same length: a
// direct `!==` on the strings returns as soon as a character differs, which
// leaks the length and the matching prefix of the shared bootstrap secret.
function secretMatches(provided: string, expected: string): boolean {
	const a = createHash('sha256').update(provided).digest();
	const b = createHash('sha256').update(expected).digest();
	return timingSafeEqual(a, b);
}

// Throws rather than returning 0 when the lookup fails. A database that cannot
// be read must never look like "no admin exists yet" — that is what re-arms the
// bootstrap path on a misconfigured environment.
async function adminCount(): Promise<number> {
	const { count, error: countError } = await supabaseAdmin
		.from('profiles')
		.select('id', { count: 'exact', head: true })
		.eq('role', 'admin');
	if (countError) {
		console.error('[tic-admin] admin lookup failed:', countError);
		error(503, 'Could not reach the database to check for existing admins.');
	}
	return count ?? 0;
}

export const GET: RequestHandler = async ({ cookies }) => {
	const session = readTicAdminSession(cookies);
	try {
		return json({
			ok: session !== null,
			admin: session,
			needsBootstrap: (await adminCount()) === 0
		});
	} catch {
		// Reported as data so the caller can tell "database down" apart from
		// "first run", which a bare needsBootstrap flag cannot express.
		return json({ ok: false, admin: session, needsBootstrap: false, dbError: true });
	}
};

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	// Both branches below are password guesses — the shared bootstrap secret and,
	// through the token, an account password. Neither had a brake on it.
	if (!(await withinLimit('adminLogin', getClientAddress()))) {
		error(
			429,
			`Too many sign-in attempts. Try again in ${retryMinutes(LIMITS.adminLogin)} minutes.`
		);
	}

	const body = (await request.json().catch(() => ({}))) as {
		accessToken?: string;
		bootstrapPassword?: string;
		email?: string;
		password?: string;
		fullName?: string;
	};

	// --- bootstrap: only while the console has no admin at all ---------------
	if (body.bootstrapPassword !== undefined) {
		if ((await adminCount()) > 0) {
			error(403, 'An admin account already exists. Sign in with your own credentials.');
		}
		if (!TIC_ADMIN_PASSWORD || !secretMatches(body.bootstrapPassword, TIC_ADMIN_PASSWORD)) {
			return json({ ok: false, error: 'Incorrect setup password.' }, { status: 401 });
		}
		const email = body.email?.trim().toLowerCase();
		if (!email || !body.password || body.password.length < 8) {
			error(400, 'Email and a password of at least 8 characters are required.');
		}

		const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
			email,
			password: body.password,
			email_confirm: true,
			user_metadata: { role: 'admin', full_name: body.fullName?.trim() ?? '' }
		});
		if (createError || !created.user)
			error(400, createError?.message ?? 'Could not create account.');

		// The signup trigger writes the profile with whatever role the metadata
		// asked for, but only 'founder' and 'company' are honoured there — so the
		// promotion to admin happens here, with the service role.
		const { error: roleError } = await supabaseAdmin
			.from('profiles')
			.update({ role: 'admin', full_name: body.fullName?.trim() ?? '', email })
			.eq('id', created.user.id);
		if (roleError) error(500, roleError.message);

		await supabaseAdmin.from('audit_log').insert({
			source: 'app',
			actor_id: created.user.id,
			actor_label: `${body.fullName?.trim() || email} (admin)`,
			action: 'bootstrapped the first admin account',
			table_name: 'profiles',
			record_id: created.user.id
		});

		return json({ ok: true, created: true });
	}

	// --- normal sign-in: verify the Supabase token, then check the role ------
	if (!body.accessToken) error(400, 'Missing access token.');

	const { data, error: authError } = await supabaseAdmin.auth.getUser(body.accessToken);
	if (authError || !data.user) {
		return json({ ok: false, error: 'Invalid or expired session.' }, { status: 401 });
	}

	const { data: profile } = await supabaseAdmin
		.from('profiles')
		.select('role, full_name, email')
		.eq('id', data.user.id)
		.maybeSingle();

	if (profile?.role !== 'admin') {
		return json({ ok: false, error: 'This account does not have admin access.' }, { status: 403 });
	}

	const session = {
		userId: data.user.id,
		email: profile.email || data.user.email || '',
		name: profile.full_name || ''
	};
	issueTicAdminSession(cookies, session);

	await supabaseAdmin.from('audit_log').insert({
		source: 'app',
		actor_id: session.userId,
		actor_label: `${session.name || session.email} (admin)`,
		action: 'signed in to the admin console'
	});

	return json({ ok: true, admin: session });
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	const session = readTicAdminSession(cookies);
	if (session) {
		await supabaseAdmin.from('audit_log').insert({
			source: 'app',
			actor_id: session.userId,
			actor_label: `${session.name || session.email} (admin)`,
			action: 'signed out of the admin console'
		});
	}
	clearTicAdminSession(cookies);
	return json({ ok: true });
};
