// Every kind of account, and what each one may open in the TIC console.
//
// One table, read by everything that has to agree about access: the sidebar
// hides what a role cannot open, the request hook refuses the page and its API
// routes, the assistant only gets the tools for sections the role can see, and
// the Roles page prints the table as it stands. Changing a role's access is an
// edit here and nowhere else.

export const STAFF_ROLES = [
	'developer',
	'admin',
	'tic_admin',
	'tic_ceo',
	'tic_chairman',
	'tic_coordinator',
	'tic_head',
	'tic_president'
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type AccountRole = StaffRole | 'founder';

export const ACCOUNT_ROLES: AccountRole[] = [...STAFF_ROLES, 'founder'];

export type ConsoleSection =
	| 'overview'
	| 'approvals'
	| 'companies'
	| 'applications'
	| 'jobs'
	| 'job-applications'
	| 'users'
	| 'roles'
	| 'activity'
	| 'content'
	| 'email'
	| 'storage'
	| 'support'
	| 'assistant';

/** In sidebar order, with the label the Roles page prints for each. */
export const CONSOLE_SECTIONS: { key: ConsoleSection; label: string }[] = [
	{ key: 'overview', label: 'Overview' },
	{ key: 'approvals', label: 'Approvals' },
	{ key: 'companies', label: 'Companies' },
	{ key: 'applications', label: 'Applications' },
	{ key: 'jobs', label: 'Posted jobs' },
	{ key: 'job-applications', label: 'Role applicants' },
	{ key: 'users', label: 'Users' },
	{ key: 'roles', label: 'Roles' },
	{ key: 'activity', label: 'Activity' },
	{ key: 'content', label: 'Content' },
	{ key: 'email', label: 'Email' },
	{ key: 'storage', label: 'Storage' },
	{ key: 'support', label: 'Support' },
	{ key: 'assistant', label: 'Assistant' }
];

const ALL = CONSOLE_SECTIONS.map((section) => section.key);

// The pipeline every staff role can work: the queues that move a startup or an
// applicant along, plus the way to ask about them.
const PIPELINE: ConsoleSection[] = [
	'overview',
	'approvals',
	'companies',
	'applications',
	'jobs',
	'job-applications',
	'support',
	'assistant'
];

export type RoleInfo = {
	label: string;
	/** A few words, for the role picker. */
	hint: string;
	blurb: string;
	/** Empty for a founder: they have their own console, not a slice of this one. */
	sections: ConsoleSection[];
	/** May open the console as another account. */
	viewAs?: boolean;
	/** May set another account's password from the Users form. */
	setsPasswords?: boolean;
};

export const ROLE_INFO: Record<AccountRole, RoleInfo> = {
	developer: {
		label: 'Developer',
		hint: 'Everything, plus view as',
		blurb: 'Builds and maintains the console. Everything, plus viewing as any account.',
		sections: ALL,
		viewAs: true,
		setsPasswords: true
	},
	admin: {
		label: 'Admin',
		hint: 'Runs this console',
		blurb: 'Runs this console end to end, including accounts and roles.',
		sections: ALL,
		setsPasswords: true
	},
	tic_admin: {
		label: 'TIC Admin',
		hint: 'Operations and accounts',
		blurb: 'Day-to-day operations — every queue, staff accounts, the website, email and storage.',
		sections: ALL,
		setsPasswords: true
	},
	tic_ceo: {
		label: 'TIC CEO',
		hint: 'Pipeline and activity',
		blurb: 'Leads the incubator. Sees the pipeline and the activity behind it.',
		sections: [...PIPELINE, 'activity']
	},
	tic_chairman: {
		label: 'TIC Chairman',
		hint: 'Pipeline and activity',
		blurb: 'Chairs the governing body. Sees the pipeline and the activity behind it.',
		sections: [...PIPELINE, 'activity']
	},
	tic_president: {
		label: 'TIC President',
		hint: 'Pipeline and activity',
		blurb: 'Oversees the incubator. Sees the pipeline and the activity behind it.',
		sections: [...PIPELINE, 'activity']
	},
	tic_head: {
		label: 'TIC Head',
		hint: 'Pipeline and activity',
		blurb: 'Heads a TIC function. Works the pipeline and reads the activity trail.',
		sections: [...PIPELINE, 'activity']
	},
	tic_coordinator: {
		label: 'TIC Coordinator',
		hint: 'Pipeline, website, email',
		blurb: 'Coordinates programmes. Works the pipeline and keeps the website and emails current.',
		sections: [...PIPELINE, 'content', 'email']
	},
	founder: {
		label: 'Founder',
		hint: 'Runs startups',
		blurb: 'Runs a startup. Uses the founder console, not this one.',
		sections: []
	}
};

export function isStaffRole(role: string | null | undefined): role is StaffRole {
	return (STAFF_ROLES as readonly string[]).includes(role ?? '');
}

export function roleLabel(role: string | null | undefined): string {
	return ROLE_INFO[role as AccountRole]?.label ?? 'Founder';
}

export function canOpen(role: string | null | undefined, section: ConsoleSection): boolean {
	if (!isStaffRole(role)) return false;
	return ROLE_INFO[role].sections.includes(section);
}

/** Roles with the run of the console — the ones "last admin" protection counts. */
export const FULL_ADMIN_ROLES: StaffRole[] = ['developer', 'admin'];

// Who outranks whom when managing an account. A developer manages anyone; an
// admin anyone but a developer; a TIC Admin other TIC Admins and everyone
// below. So nobody can take over an account ranked above their own — by
// resetting its password, say, or by demoting it.
function rank(role: string | null | undefined): number {
	if (role === 'developer') return 3;
	if (role === 'admin') return 2;
	if (role === 'tic_admin') return 1;
	return 0;
}

export function canManage(
	actor: string | null | undefined,
	target: string | null | undefined
): boolean {
	const mine = rank(actor);
	if (mine === 0) return false;
	return mine === 3 || rank(target) <= mine;
}

/** Whether `actor` may hand out (or take away) `role`. */
export function canGrant(
	actor: string | null | undefined,
	role: string | null | undefined
): boolean {
	return canManage(actor, role);
}

export function canSetPassword(
	actor: string | null | undefined,
	target: string | null | undefined
): boolean {
	return Boolean(ROLE_INFO[actor as AccountRole]?.setsPasswords) && canManage(actor, target);
}

// ---- paths ------------------------------------------------------------------

// The first segment under /tic-admin, and under /api/tic-admin, is the section.
// The two only disagree where an API was named for what it does rather than for
// the screen that calls it.
const PAGE_SEGMENT: Record<string, ConsoleSection> = {
	'': 'overview',
	'home-page': 'overview',
	ai: 'assistant'
};

const API_SEGMENT: Record<string, ConsoleSection> = {
	ai: 'assistant',
	newsletter: 'email'
};

function lookup(segment: string, overrides: Record<string, ConsoleSection>): ConsoleSection | null {
	if (segment in overrides) return overrides[segment];
	return ALL.includes(segment as ConsoleSection) ? (segment as ConsoleSection) : null;
}

/** The section a /tic-admin page belongs to, or null for one outside any. */
export function sectionForPage(pathname: string): ConsoleSection | null {
	const match = pathname.match(/^\/tic-admin(?:\/([^/]+))?/);
	if (!match) return null;
	return lookup(match[1] ?? '', PAGE_SEGMENT);
}

/** The section an /api/tic-admin route belongs to, or null for one outside any. */
export function sectionForApi(pathname: string): ConsoleSection | null {
	const match = pathname.match(/^\/api\/tic-admin\/([^/]+)/);
	if (!match) return null;
	return lookup(match[1], API_SEGMENT);
}
