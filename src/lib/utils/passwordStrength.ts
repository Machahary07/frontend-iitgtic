// A quick, local guess at how strong a password is — for the meter under every
// "choose a password" field. It nudges, it does not enforce: each form keeps its
// own minimum, and Supabase has the final say.

export type Strength = {
	/** 0 (very weak) to 4 (strong). */
	score: 0 | 1 | 2 | 3 | 4;
	label: string;
	/** One thing that would make it stronger, or '' when there is nothing to add. */
	tip: string;
};

const LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];

// The first things anyone tries. Matching is on the lower-cased password.
const COMMON = [
	'password',
	'passw0rd',
	'qwerty',
	'letmein',
	'welcome',
	'admin',
	'iitg',
	'iitgtic',
	'tic',
	'123456',
	'12345678',
	'abc123',
	'111111',
	'iloveyou'
];

export function passwordStrength(password: string): Strength {
	const value = password ?? '';
	const lower = value.toLowerCase();

	const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;

	let points = 0;
	if (value.length >= 8) points += 1;
	if (value.length >= 12) points += 1;
	if (value.length >= 16) points += 1;
	if (classes >= 3) points += 1;
	if (classes === 4) points += 1;

	const common = COMMON.some((word) => lower.includes(word));
	const repeated = /(.)\1{2,}/.test(value);
	const sequence = /(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf|zxcv)/.test(lower);
	if (common) points -= 2;
	if (repeated) points -= 1;
	if (sequence) points -= 1;
	if (value.length < 8) points = Math.min(points, 1);

	const score = Math.max(0, Math.min(4, points)) as Strength['score'];

	let tip = '';
	if (value.length < 8) tip = 'Use at least 8 characters.';
	else if (common) tip = 'Avoid common words like "password" or the centre’s name.';
	else if (repeated || sequence) tip = 'Avoid repeats and sequences like "aaa" or "1234".';
	else if (value.length < 12) tip = 'Longer is stronger — aim for 12 or more.';
	else if (classes < 3) tip = 'Mix in capitals, numbers or symbols.';
	else if (score < 4) tip = 'Add a symbol or a few more characters.';

	return { score, label: LABELS[score], tip };
}
