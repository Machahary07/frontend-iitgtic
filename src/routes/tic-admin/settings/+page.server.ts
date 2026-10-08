import { adminDb } from '$lib/server/adminData';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const { data } = await adminDb(admin!)
		.from('profiles')
		.select('full_name, email, phone, role, responsibility, department')
		.eq('id', admin!.userId)
		.maybeSingle();

	return {
		me: {
			fullName: (data?.full_name as string) ?? '',
			email: (data?.email as string) || admin!.email,
			phone: (data?.phone as string) ?? '',
			role: (data?.role as string) ?? admin!.role,
			responsibility: (data?.responsibility as string) ?? '',
			department: (data?.department as string) ?? ''
		},
		// While a developer views as someone, these are that person's settings, and
		// nothing here may be changed.
		viewingAs: Boolean(admin!.actor)
	};
};
