// Sidebar for the TIC team admin. Shared so a new section is added in one place
// rather than in every page's local copy.

export const TIC_ADMIN_NAV = [
	{ label: 'Overview', href: '/tic-admin' },
	{ label: 'Companies', href: '/tic-admin/companies' },
	{ label: 'Applications', href: '/tic-admin/applications' },
	{ label: 'Posted jobs', href: '/tic-admin/jobs' },
	{ label: 'Role applicants', href: '/tic-admin/job-applications' },
	{ separator: true as const },
	{ label: 'Users', href: '/tic-admin/users' },
	{ label: 'Activity', href: '/tic-admin/activity' },
	{ separator: true as const },
	{ label: 'Content', href: '/tic-admin/content' },
	{ label: 'Email', href: '/tic-admin/email' },
	{ label: 'Storage', href: '/tic-admin/storage' }
];
