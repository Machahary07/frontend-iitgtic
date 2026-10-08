import { error } from '@sveltejs/kit';
import { getOpenJob } from '$lib/server/jobs';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const job = await getOpenJob(params.id);
	if (!job) error(404, 'This role is closed or no longer listed.');
	// The company id stays on the server; the page needs only the public fields.
	return { job: { ...job, companyId: undefined, maxApplicants: undefined } };
};
