// Sidebar for the company job-posting portal. Shared for the same reason the TIC
// one is: three pages were each carrying their own copy of this list, so adding
// a section meant editing all three and the one you forgot lost its nav.

import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import PlusCircle from '@lucide/svelte/icons/circle-plus';
import Users from '@lucide/svelte/icons/users';
import Settings from '@lucide/svelte/icons/settings';

import type { NavItem } from '$lib/utils/adminNavTypes';

export const COMPANY_PORTAL_NAV: NavItem[] = [
	{
		label: 'Dashboard',
		href: '/opportunities/job-posting-admin',
		icon: LayoutDashboard,
		tone: 'neutral'
	},
	{
		label: 'Post a role',
		href: '/opportunities/job-posting-admin/edit/new',
		icon: PlusCircle,
		tone: 'good'
	},
	{
		label: 'Applicants',
		href: '/opportunities/job-posting-admin/applicants',
		icon: Users,
		tone: 'info'
	},
	{ separator: true as const },
	{
		label: 'Account settings',
		href: '/opportunities/job-posting-admin/admin-settings',
		icon: Settings,
		tone: 'violet'
	}
];
