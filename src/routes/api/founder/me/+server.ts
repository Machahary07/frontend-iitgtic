import { error, json } from '@sveltejs/kit';
import { logFounderAction, requireSignedInFounder } from '$lib/server/founderGuard';
import { isValidPhone } from '$lib/utils/phone';
import type { RequestHandler } from './$types';

// The founder's own details, as opposed to a company's. Unlike company details
// these are not public copy, so they apply straight away with no TIC review.
// The sign-in address is not changed here — it is the login, and moving it
// needs a confirmation round of its own.

export const PATCH: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireSignedInFounder(cookies);
	const body = (await request.json().catch(() => ({}))) as { fullName?: string; phone?: string };

	const fullName = body.fullName?.trim() ?? '';
	const phone = body.phone?.trim() ?? '';
	if (!fullName) error(400, 'Name is required.');
	if (phone && !isValidPhone(phone)) error(400, 'Phone number must be exactly 10 digits.');

	const { error: updateError } = await ctx.db
		.from('profiles')
		.update({ full_name: fullName, phone })
		.eq('id', ctx.founder.userId);
	if (updateError) error(500, updateError.message);

	await logFounderAction(ctx, 'updated their own details', {
		table: 'profiles',
		recordId: ctx.founder.userId
	});
	return json({ ok: true });
};
