import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { logFounderAction, requireSignedInFounder } from '$lib/server/founderGuard';
import { sendTemplateEmail } from '$lib/server/email';
import { DOCUMENT_FIELDS, missingRequiredAnswers } from '$lib/utils/applicationSchema';
import type { ApplicationDocuments } from '$lib/utils/applications';
import type { RequestHandler } from './$types';

// Submits again an application TIC sent back ('returned'). A founder cannot write
// `status` themselves, so this is where it moves back to 'submitted' — after the
// same checks a first submit meets: the founder who sent it, a confirmed email,
// every required answer, and a pitch deck.
//
// POST { id, answers, documents }  documents = the kept uploads plus any new ones

const BUCKET = 'application-documents';

export const POST: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireSignedInFounder(cookies);
	const userId = ctx.founder.userId;
	const body = (await request.json().catch(() => ({}))) as {
		id?: string;
		answers?: Record<string, unknown>;
		documents?: ApplicationDocuments;
	};
	if (!body.id) error(400, 'Missing application id.');

	const { data: app } = await supabaseAdmin
		.from('applications')
		.select('id, user_id, status, documents')
		.eq('id', body.id)
		.maybeSingle();
	if (!app || app.user_id !== userId) error(404, 'Application not found.');
	if (app.status !== 'returned') error(409, 'This application is not waiting to be submitted again.');

	const { data: profile } = await supabaseAdmin
		.from('profiles')
		.select('email_verified')
		.eq('id', userId)
		.maybeSingle();
	if (!profile?.email_verified) {
		error(403, 'Please confirm your email before submitting — check your inbox for the link.');
	}

	const answers = { ...(body.answers ?? {}) };
	for (const field of DOCUMENT_FIELDS) delete answers[field];
	const missing = missingRequiredAnswers(answers);
	if (missing.length > 0) {
		error(400, `Please complete every required field before submitting: ${missing.join(', ')}.`);
	}

	// Only known fields, and only files in this founder's own folder — the row is
	// what TIC opens, so it must not be pointed at someone else's upload.
	const documents: ApplicationDocuments = {};
	for (const field of DOCUMENT_FIELDS) {
		const entry = body.documents?.[field];
		if (!entry) continue;
		if (typeof entry.path !== 'string' || !entry.path.startsWith(`${userId}/`)) {
			error(400, 'Unknown document.');
		}
		documents[field] = {
			path: entry.path,
			name: String(entry.name ?? ''),
			size: Number(entry.size) || 0
		};
	}
	if (!documents.pitchDeck) error(400, 'A pitch deck PDF is required before submitting.');

	const { data: updated, error: updateError } = await supabaseAdmin
		.from('applications')
		.update({
			answers,
			documents,
			full_name: String(answers.fullName ?? ''),
			email: String(answers.email ?? ''),
			startup_name: String(answers.startupName ?? ''),
			status: 'submitted',
			// The note said why it came back; it has done its job.
			applicant_message: null,
			reviewed_at: null
		})
		.eq('id', app.id)
		.eq('status', 'returned')
		.select('full_name, email, startup_name')
		.maybeSingle();
	if (updateError) error(500, updateError.message);
	if (!updated) error(409, 'This application is not waiting to be submitted again.');

	// Uploads the founder replaced are no longer named by the row, and nothing
	// else would ever find them to delete.
	const keptPaths = new Set(Object.values(documents).map((d) => d.path));
	const replaced = Object.values((app.documents ?? {}) as ApplicationDocuments)
		.map((d) => d?.path)
		.filter((p): p is string => Boolean(p) && !keptPaths.has(p));
	if (replaced.length > 0) await supabaseAdmin.storage.from(BUCKET).remove(replaced);

	await logFounderAction(ctx, 'submitted the returned application again', {
		table: 'applications',
		recordId: app.id
	});

	await sendTemplateEmail({
		templateKey: 'application-received',
		to: updated.email as string,
		toName: (updated.full_name as string) ?? '',
		variables: {
			fullName: (updated.full_name as string) ?? '',
			startupName: (updated.startup_name as string) ?? '',
			applicationId: app.id
		},
		context: { table: 'applications', recordId: app.id, resubmitted: true }
	});

	return json({ ok: true });
};
