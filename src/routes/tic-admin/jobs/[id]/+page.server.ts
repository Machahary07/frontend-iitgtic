import { error } from '@sveltejs/kit';
import { adminDb } from '$lib/server/adminData';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params }) => {
	if (params.id === 'new') return { job: null };

	const { admin } = await parent();
	const { data } = await adminDb(admin!)
		.from('jobs')
		.select('id, role, location, type, work_mode, sector, pay, closes_on, max_applicants, description, status')
		.eq('id', params.id)
		.eq('owner', 'tic')
		.maybeSingle();
	if (!data) error(404, 'Role not found.');

	return { job: data };
};
