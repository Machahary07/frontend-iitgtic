// Field labels for the 8-step incubation application, in the order the applicant
// answered them. The admin detail view renders from this so a stored answers blob
// reads as the original form rather than as raw JSON keys.

export type ApplicationField = {
	key: string;
	label: string;
	long?: boolean;
	// Mirrors the `*` on the form. Kept here so the form, the submit guard and the
	// admin view all read the same list rather than three drifting copies.
	required?: boolean;
};

export type ApplicationSection = {
	step: number;
	title: string;
	fields: ApplicationField[];
};

export const APPLICATION_SECTIONS: ApplicationSection[] = [
	{
		step: 1,
		title: 'Founder info',
		fields: [
			{ key: 'fullName', label: 'Full name', required: true },
			{ key: 'email', label: 'Email', required: true },
			{ key: 'phone', label: 'Phone', required: true },
			{ key: 'role', label: 'Role', required: true },
			{ key: 'location', label: 'Location', required: true },
			{ key: 'university', label: 'University', required: true },
			{ key: 'linkedin', label: 'LinkedIn' },
			{ key: 'coFounders', label: 'Co-founders' }
		]
	},
	{
		step: 2,
		title: 'Startup basics',
		fields: [
			{ key: 'startupName', label: 'Startup name', required: true },
			{ key: 'stage', label: 'Stage', required: true },
			{ key: 'industry', label: 'Industry', required: true },
			{ key: 'yearFounded', label: 'Year founded', required: true },
			{ key: 'teamSize', label: 'Team size', required: true },
			{ key: 'website', label: 'Website' },
			{ key: 'incorporation', label: 'Incorporation' }
		]
	},
	{
		step: 3,
		title: 'Problem & solution',
		fields: [
			{ key: 'problem', label: 'Problem', long: true, required: true },
			{ key: 'solution', label: 'Solution', long: true, required: true },
			{ key: 'differentiation', label: 'Differentiation', long: true, required: true },
			{ key: 'whyNow', label: 'Why now', long: true, required: true }
		]
	},
	{
		step: 4,
		title: 'Product & traction',
		fields: [
			{ key: 'productDescription', label: 'Product', long: true, required: true },
			{ key: 'techStack', label: 'Tech stack', required: true },
			{ key: 'targetCustomers', label: 'Target customers', long: true, required: true },
			{ key: 'users', label: 'Users' },
			{ key: 'revenue', label: 'Revenue' },
			{ key: 'demoLink', label: 'Demo link' },
			{ key: 'partnerships', label: 'Partnerships', long: true }
		]
	},
	{
		step: 5,
		title: 'Business & funding',
		fields: [
			{ key: 'revenueModel', label: 'Revenue model', long: true, required: true },
			{ key: 'gtmStrategy', label: 'Go-to-market', long: true, required: true },
			{ key: 'fundingStatus', label: 'Funding status', required: true },
			{ key: 'investmentRequired', label: 'Investment required', required: true },
			{ key: 'useOfFunds', label: 'Use of funds', long: true, required: true },
			{ key: 'competitors', label: 'Competitors', long: true },
			{ key: 'previousFunding', label: 'Previous funding', long: true }
		]
	},
	{
		step: 6,
		title: 'Incubation fit',
		fields: [
			{ key: 'whyTic', label: 'Why TIC', long: true, required: true },
			{ key: 'expectedOutcomes', label: 'Expected outcomes', long: true, required: true },
			{ key: 'biggestChallenge', label: 'Biggest challenge', long: true, required: true },
			{ key: 'longTermVision', label: 'Long-term vision', long: true },
			{ key: 'supportNeeded', label: 'Support needed', required: true }
		]
	},
	{
		step: 8,
		title: 'Consent',
		fields: [
			{ key: 'infoAccurate', label: 'Information is accurate', required: true },
			{ key: 'agreeTerms', label: 'Agreed to terms', required: true },
			{ key: 'allowReview', label: 'Allows committee review', required: true }
		]
	}
];

// Every answer key the form marks with a `*`, in form order.
export const REQUIRED_ANSWER_KEYS: string[] = APPLICATION_SECTIONS.flatMap((section) =>
	section.fields.filter((f) => f.required).map((f) => f.key)
);

// Returns the labels of the required answers that came through blank. An empty
// array means the payload is complete. `supportNeeded` is a string[] and the
// three consents are booleans, so emptiness is not just `=== ''`.
export function missingRequiredAnswers(answers: Record<string, unknown>): string[] {
	const missing: string[] = [];
	for (const section of APPLICATION_SECTIONS) {
		for (const field of section.fields) {
			if (!field.required) continue;
			const value = answers[field.key];
			const empty =
				value === null ||
				value === undefined ||
				value === false ||
				(typeof value === 'string' && value.trim() === '') ||
				(Array.isArray(value) && value.length === 0);
			if (empty) missing.push(field.label);
		}
	}
	return missing;
}

export const DOCUMENT_LABELS: Record<string, string> = {
	pitchDeck: 'Pitch deck',
	founderCv: 'Founder CV',
	financialProjections: 'Financial projections',
	incorporationCert: 'Incorporation certificate'
};

type CoFounder = { name?: string; email?: string; role?: string };

// Renders any stored answer as display text. The form mixes strings, booleans,
// a string[] (supportNeeded) and an object[] (coFounders).
export function formatAnswer(value: unknown): string {
	if (value === null || value === undefined || value === '') return '—';
	if (typeof value === 'boolean') return value ? 'Yes' : 'No';

	if (Array.isArray(value)) {
		if (value.length === 0) return '—';
		if (typeof value[0] === 'string') return (value as string[]).join(', ');
		return (value as CoFounder[])
			.map((c) => [c.name, c.role, c.email].filter(Boolean).join(' · '))
			.filter(Boolean)
			.join('\n');
	}

	if (typeof value === 'object') return JSON.stringify(value, null, 2);
	return String(value);
}
