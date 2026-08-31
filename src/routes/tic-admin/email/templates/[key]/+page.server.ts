import { error } from '@sveltejs/kit';
import { emailConfig, resolveTemplate } from '$lib/server/email';
import { EMAIL_LAYOUT_KEY, COMMON_VARIABLES } from '$lib/utils/emailTemplates';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params }) => {
	await parent();

	const template = await resolveTemplate(params.key);
	if (!template) error(404, 'Unknown email template.');

	// The preview renders through the live layout, so the editor needs it too —
	// except when the layout is what is being edited, where the draft is its own
	// wrapper.
	const layout =
		template.key === EMAIL_LAYOUT_KEY ? template : await resolveTemplate(EMAIL_LAYOUT_KEY);

	const config = emailConfig();

	return {
		template,
		layoutBody: layout?.body ?? '',
		commonVariables: COMMON_VARIABLES,
		config: {
			configured: config.configured,
			from: config.from,
			siteName: config.siteName,
			siteUrl: config.siteUrl,
			usingTestSender: config.usingTestSender
		}
	};
};
