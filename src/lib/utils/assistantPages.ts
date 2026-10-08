// What each page of the site is, in the assistant's words.
//
// Shared by both sides, the way the school ERP does it: the panel names the page
// it can see ("Reading: Companies"), and the server turns the same entry into a
// paragraph of notes in the system prompt, next to a snapshot of what is on the
// screen. This is description, not permission — what the assistant can actually
// read or change is still decided by the tools its role is given.

export type PageKnowledge = {
	title: string;
	/** What the page is for and what is on it. */
	about: string;
	/** Things a person can actually do here, so the model stops inventing others. */
	actions?: string[];
};

export const PAGES: Record<string, PageKnowledge> = {
	// ---- TIC console --------------------------------------------------------
	'/tic-admin': {
		title: 'Overview',
		about:
			'The console front page: counts of pending, verified and rejected companies, posted jobs, new incubation applications and new role applicants, with the most recent of each.'
	},
	'/tic-admin/approvals': {
		title: 'Approvals',
		about:
			'The queue that holds the public site up: new startups waiting to be verified, job postings waiting to go live, team members founders have added, and profile changes founders asked for.',
		actions: ['Approve or reject each item']
	},
	'/tic-admin/companies': {
		title: 'Companies',
		about:
			'Every startup registered on the site, filtered by pending, verified or rejected. Only verified companies can post roles.',
		actions: ['Verify or reject a company', 'Delete a company']
	},
	'/tic-admin/applications': {
		title: 'Applications',
		about:
			'Founders applying to be incubated, by status: submitted, under review, accepted, rejected. Each opens to the full application and its documents.',
		actions: ['Open an application', 'Move it between statuses']
	},
	'/tic-admin/jobs': {
		title: 'Job postings',
		about:
			'Two tabs. TIC: the centre’s own roles, which TIC posts, edits, closes and deletes, with a response count per role. Incubatees: every startup’s roles with how many applied — read-only, except removing one with a reason the founder is emailed.',
		actions: ['Post a TIC role', 'Edit, close or delete a TIC role', 'Remove a startup role with a reason']
	},
	'/tic-admin/job-applications': {
		title: 'Job responses',
		about:
			'People who applied to one of TIC’s own roles, with their resume. Received and read, no stages. Resumes are deleted 90 days after a role ends. Not the same as incubation applications.',
		actions: ['Open an application', 'Download all resumes as a zip', 'Export to CSV']
	},
	'/tic-admin/users': {
		title: 'Users',
		about:
			'Every account: founders and TIC staff, with role, department, responsibility and when they last signed in.',
		actions: [
			'Add a staff account',
			'Edit details or set a password',
			'Deactivate or activate',
			'Delete'
		]
	},
	'/tic-admin/roles': {
		title: 'Roles',
		about:
			'Each staff role, who holds it, and a table of which console sections each role can open.'
	},
	'/tic-admin/activity': {
		title: 'Activity',
		about:
			'The audit trail of every change, by whom and when, and page-impression traffic for the public site.'
	},
	'/tic-admin/content': {
		title: 'Content',
		about: 'The editable copy of the public website, section by section.',
		actions: ['Open a section and edit its text and images']
	},
	'/tic-admin/email': {
		title: 'Email',
		about:
			'Sending: the monthly and daily meter, thirty days of delivery, the delivery log, suppressed addresses and the newsletter list.',
		actions: ['Open the email templates', 'Send the newsletter']
	},
	'/tic-admin/email/templates': {
		title: 'Email templates',
		about: 'Every transactional email the site sends, each editable block by block.'
	},
	'/tic-admin/storage': {
		title: 'Storage',
		about:
			'Uploaded files by bucket — application documents, resumes, site images, email attachments.',
		actions: ['Find and delete files']
	},
	'/tic-admin/support': {
		title: 'Support',
		about: 'Who to contact about the console itself.'
	},

	// ---- founder console ------------------------------------------------------
	'/founder': {
		title: 'Founder console',
		about: "A founder's own startup: its standing with TIC."
	},
	'/founder/jobs': { title: 'Founder · Jobs', about: "The startup's job postings." },
	'/founder/applicants': {
		title: 'Founder · Applicants',
		about: "People who applied to the startup's roles."
	},
	'/founder/users': { title: 'Founder · Team', about: "The startup's team members." },
	'/founder/companies': { title: 'Founder · Startups', about: 'Every startup this founder runs.' },
	'/founder/settings': { title: 'Founder · Company', about: "The startup's details." },
	'/founder/activity': {
		title: 'Founder · Activity',
		about: "Everything that happened to the startup's records."
	},

	// ---- public site ------------------------------------------------------------
	'/': { title: 'Home', about: 'The public front page.' },
	'/about': { title: 'About TIC', about: 'Who IIT Guwahati TIC is.' },
	'/incubation': { title: 'Incubation', about: 'What incubation at TIC offers.' },
	'/incubated-startups': { title: 'Incubated startups', about: 'The startups TIC has incubated.' },
	'/programs': { title: 'Schemes & programmes', about: 'Funding schemes and programmes.' },
	'/opportunities': { title: 'Opportunities', about: 'The public job board.' },
	'/events': { title: 'Events', about: 'Events and workshops.' },
	'/partners': { title: 'Partners', about: "TIC's partners." },
	'/apply': { title: 'Apply', about: 'Where a founder signs up to apply for incubation.' },
	'/contact': { title: 'Contact', about: 'How to reach TIC.' }
};

/** Exact path first, then the longest parent — /tic-admin/applications/abc falls
 *  back to Applications, which is accurate: it is one row of that list. */
export function pageKnowledge(path: string): PageKnowledge | null {
	const clean = path.replace(/\/+$/, '') || '/';
	if (PAGES[clean]) return PAGES[clean];
	let best = '';
	for (const key of Object.keys(PAGES)) {
		if (key !== '/' && clean.startsWith(key + '/') && key.length > best.length) best = key;
	}
	return best ? PAGES[best] : null;
}

/** Every page, one line each, for the model's map of the site. */
export function siteMap(): string {
	return Object.entries(PAGES)
		.map(([path, page]) => `- ${path} — ${page.title}: ${page.about}`)
		.join('\n');
}
