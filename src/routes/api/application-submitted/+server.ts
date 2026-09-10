import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { sendTemplateEmail } from '$lib/server/email';
import { LIMITS, retryMinutes, withinLimit } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';

// Receipt for a submitted incubation application. The browser inserts the row
// itself with supabase-js, then calls this to have the confirmation email sent
// server-side (the Resend key never reaches the client).
//
// The guard is the session, not the request body: the caller must present the
// founder's access token, and the application must belong to that user. The
// recipient address is read from the stored row, never taken from the request,
// so this cannot be used to mail an address the caller does not own.

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!(await withinLimit('applicationReceipt', getClientAddress()))) {
		error(429, `Too many requests. Try again in ${retryMinutes(LIMITS.applicationReceipt)} minutes.`);
	}

	const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
	if (!token) error(401, 'Missing access token.');

	const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
	if (authError || !auth.user) error(401, 'Invalid session.');

	const body = (await request.json().catch(() => ({}))) as { applicationId?: string };
	const applicationId = body.applicationId?.trim();
	if (!applicationId) error(400, 'Missing application id.');

	const { data: application } = await supabaseAdmin
		.from('applications')
		.select('id, user_id, full_name, email, startup_name')
		.eq('id', applicationId)
		.maybeSingle();

	// Silent on a miss or a mismatch: answering differently for a real and an
	// invented id, or for someone else's application, would leak whether an id
	// exists and whom it belongs to.
	if (!application || application.user_id !== auth.user.id) return json({ ok: true });

	// One receipt per application. Keyed on the application id in the log context
	// rather than the address, so a founder who submits two applications gets a
	// receipt for each.
	const { count } = await supabaseAdmin
		.from('email_log')
		.select('id', { count: 'exact', head: true })
		.eq('template_key', 'application-received')
		.eq('context->>recordId', applicationId);
	if ((count ?? 0) > 0) return json({ ok: true });

	const to = (application.email as string) || auth.user.email || '';
	if (!to) return json({ ok: true });

	await sendTemplateEmail({
		templateKey: 'application-received',
		to,
		toName: (application.full_name as string) || '',
		variables: {
			fullName: (application.full_name as string) ?? '',
			startupName: (application.startup_name as string) ?? '',
			applicationId
		},
		context: { table: 'applications', recordId: applicationId }
	});

	return json({ ok: true });
};
