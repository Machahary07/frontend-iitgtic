import { emailConfig, resolveAllTemplates } from '$lib/server/email';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	await parent();
	const config = emailConfig();
	return {
		templates: await resolveAllTemplates(),
		configured: config.configured
	};
};
