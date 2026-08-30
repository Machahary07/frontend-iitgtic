// Field labels for the 8-step incubation application, in the order the applicant
// answered them. The admin detail view renders from this so a stored answers blob
// reads as the original form rather than as raw JSON keys.

export type ApplicationField = {
	key: string;
	label: string;
	long?: boolean;
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
			{ key: 'fullName', label: 'Full name' },
			{ key: 'email', label: 'Email' },
			{ key: 'phone', label: 'Phone' },
			{ key: 'role', label: 'Role' },
			{ key: 'location', label: 'Location' },
			{ key: 'university', label: 'University' },
			{ key: 'linkedin', label: 'LinkedIn' },
			{ key: 'coFounders', label: 'Co-founders' }
		]
	},
	{
		step: 2,
		title: 'Startup basics',
		fields: [
			{ key: 'startupName', label: 'Startup name' },
			{ key: 'stage', label: 'Stage' },
			{ key: 'industry', label: 'Industry' },
			{ key: 'yearFounded', label: 'Year founded' },
			{ key: 'teamSize', label: 'Team size' },
			{ key: 'website', label: 'Website' },
			{ key: 'incorporation', label: 'Incorporation' }
		]
	},
	{
		step: 3,
		title: 'Problem & solution',
		fields: [
			{ key: 'problem', label: 'Problem', long: true },
			{ key: 'solution', label: 'Solution', long: true },
			{ key: 'differentiation', label: 'Differentiation', long: true },
			{ key: 'whyNow', label: 'Why now', long: true }
		]
	},
	{
		step: 4,
		title: 'Product & traction',
		fields: [
			{ key: 'productDescription', label: 'Product', long: true },
			{ key: 'techStack', label: 'Tech stack' },
			{ key: 'targetCustomers', label: 'Target customers', long: true },
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
			{ key: 'revenueModel', label: 'Revenue model', long: true },
			{ key: 'gtmStrategy', label: 'Go-to-market', long: true },
			{ key: 'fundingStatus', label: 'Funding status' },
			{ key: 'investmentRequired', label: 'Investment required' },
			{ key: 'useOfFunds', label: 'Use of funds', long: true },
			{ key: 'competitors', label: 'Competitors', long: true },
			{ key: 'previousFunding', label: 'Previous funding', long: true }
		]
	},
	{
		step: 6,
		title: 'Incubation fit',
		fields: [
			{ key: 'whyTic', label: 'Why TIC', long: true },
			{ key: 'expectedOutcomes', label: 'Expected outcomes', long: true },
			{ key: 'biggestChallenge', label: 'Biggest challenge', long: true },
			{ key: 'longTermVision', label: 'Long-term vision', long: true },
			{ key: 'supportNeeded', label: 'Support needed' }
		]
	},
	{
		step: 8,
		title: 'Consent',
		fields: [
			{ key: 'infoAccurate', label: 'Information is accurate' },
			{ key: 'agreeTerms', label: 'Agreed to terms' },
			{ key: 'allowReview', label: 'Allows committee review' }
		]
	}
];

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
