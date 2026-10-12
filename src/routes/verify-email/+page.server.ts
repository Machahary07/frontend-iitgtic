import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { checkEmailToken } from '$lib/server/emailVerify';
import { isStaffRole } from '$lib/utils/roles';
import type { PageServerLoad } from './$types';

// The end of the confirm-your-email link. The signed token is the whole guard,
// so there is no session to read here — a valid, unexpired signature is proof
// enough to set the flag through the service role.

export const load: PageServerLoad = async ({ url }) => {
	const userId = url.searchParams.get('u') ?? '';
	const expires = url.searchParams.get('e') ?? '';
	const token = url.searchParams.get('t') ?? '';

	if (!checkEmailToken(userId, expires, token)) {
		return { ok: false, kind: 'founder' };
	}

	const { data, error } = await supabaseAdmin
		.from('profiles')
		.update({ email_verified: true })
		.eq('id', userId)
		.select('role, company_id')
		.maybeSingle();

	// Staff and the team members a founder adds confirm here too, and neither has
	// an application to go back to.
	const kind = isStaffRole(data?.role) ? 'staff' : data?.company_id ? 'member' : 'founder';
	return { ok: !error, kind };
};
