// What coordinators score a startup on in the screening call, VC-style: each
// criterion out of 10, with a line on what to look for and room for a remark.
// The key is what is stored, so a criterion can be renamed without losing the
// scores already given against it.

export type EvaluationCriterion = { key: string; name: string; tagline: string };

export const EVALUATION_CRITERIA: EvaluationCriterion[] = [
	{
		key: 'team',
		name: 'Team',
		tagline:
			'Founder–market fit, complementary skills, full-time commitment and a track record of getting things done.'
	},
	{
		key: 'problem',
		name: 'Problem',
		tagline: 'How painful and frequent it is, who exactly has it, and how they cope with it today.'
	},
	{
		key: 'solution',
		name: 'Solution & product',
		tagline:
			'Whether it really solves the problem — the insight behind it, how it differs, and what makes it hard to copy.'
	},
	{
		key: 'market',
		name: 'Market',
		tagline: 'Size and growth, a clear first customer segment, and why now is the moment.'
	},
	{
		key: 'traction',
		name: 'Traction',
		tagline: 'Users, revenue, pilots, LOIs and growth rate — evidence over promises.'
	},
	{
		key: 'business',
		name: 'Business model',
		tagline: 'How it makes money, pricing logic, unit economics and the path to sustainability.'
	},
	{
		key: 'technology',
		name: 'Technology & innovation',
		tagline: 'Technical depth, IP potential and whether the team can actually build it.'
	},
	{
		key: 'fit',
		name: 'Coachability & TIC fit',
		tagline:
			'Clarity and honesty under questioning, openness to feedback, and what TIC can add for them.'
	}
];

export const MAX_CRITERION_SCORE = 10;

export const isCriterion = (key: string) => EVALUATION_CRITERIA.some((c) => c.key === key);

export type CriterionMark = { score: number | null; remark: string };
export type Marks = Record<string, CriterionMark>;

/** One screening call as the Evaluation page shows it. */
export type EvaluationCard = {
	id: string;
	startupName: string;
	founderName: string;
	meetUrl: string | null;
	meetAt: string | null;
	meetingEndedAt: string | null;
	coordinators: { userId: string; name: string; submitted: boolean }[];
	/** The viewer's own marks and whether they have submitted (coordinators). */
	mine: Marks;
	submitted: boolean;
	/** Every coordinator's marks — admin only, null for anyone else. */
	all: { userId: string; name: string; submitted: boolean; marks: Marks }[] | null;
};
