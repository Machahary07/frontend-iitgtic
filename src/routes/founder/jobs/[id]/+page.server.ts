import { error } from '@sveltejs/kit';
import { founderDb } from '$lib/server/founderGuard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { founder, company, activeCompanyId } = await parent();
	const isNew = params.id === 'new';

	if (isNew) {
		return { isNew: true, job: null, defaultCompanyName: company?.companyName ?? '' };
	}

	if (!activeCompanyId) error(404, 'Role not found.');

	const { data } = await founderDb(founder.userId)
		.from('jobs')
		.select(
			'id, role, company, location, type, work_mode, sector, pay, closes_on, max_applicants, description, status, removed_reason'
		)
		.eq('id', params.id)
		.eq('company_id', activeCompanyId)
		.maybeSingle();

	if (!data) error(404, 'Role not found.');

	return { isNew: false, job: data, defaultCompanyName: company?.companyName ?? '' };
};
