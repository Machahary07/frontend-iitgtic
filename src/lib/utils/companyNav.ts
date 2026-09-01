// Sidebar for the company job-posting portal. Shared for the same reason the TIC
// one is: three pages were each carrying their own copy of this list, so adding
// a section meant editing all three and the one you forgot lost its nav.

export const COMPANY_PORTAL_NAV = [
	{ label: 'Dashboard', href: '/opportunities/job-posting-admin' },
	{ label: 'Post a role', href: '/opportunities/job-posting-admin/edit/new' },
	{ label: 'Applicants', href: '/opportunities/job-posting-admin/applicants' },
	{ separator: true as const },
	{ label: 'Account settings', href: '/opportunities/job-posting-admin/admin-settings' }
];
