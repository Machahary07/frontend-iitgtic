// The steps of an application that get a mark out of 100. Consent is a yes/no,
// not something to judge, so it is left out. Shared by the review page, the
// scores endpoint and the decision emails, so all three list the same steps.

import { APPLICATION_SECTIONS } from '$lib/utils/applicationSchema';

export const SCORED_STEPS: { step: number; title: string }[] = [
	...APPLICATION_SECTIONS.filter((s) => s.title !== 'Consent').map((s) => ({
		step: s.step,
		title: s.title
	})),
	{ step: 7, title: 'Documents' }
].sort((a, b) => a.step - b.step);

export const isScoredStep = (step: number) => SCORED_STEPS.some((s) => s.step === step);
