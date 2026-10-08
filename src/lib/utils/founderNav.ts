// Sidebar for the founder console. Same shape as the TIC one, deliberately much
// shorter: a founder runs their own startups, not a site.
//
// Everything below Startups is about the one company named in the switcher at
// the top of the page. "Team" and "Details" are owner-only in the pages
// themselves; they stay in the nav for an added member so the console does not
// appear to change shape depending on who is looking at it, and the page says
// who can act.

import Home from '@lucide/svelte/icons/house';
import FileText from '@lucide/svelte/icons/file-text';
import Briefcase from '@lucide/svelte/icons/briefcase';
import UserSearch from '@lucide/svelte/icons/user-search';
import Users from '@lucide/svelte/icons/users';
import Activity from '@lucide/svelte/icons/activity';
import Building2 from '@lucide/svelte/icons/building-2';
import Rocket from '@lucide/svelte/icons/rocket';
import LifeBuoy from '@lucide/svelte/icons/life-buoy';
import Settings from '@lucide/svelte/icons/settings';

import type { NavItem } from '$lib/utils/adminNavTypes';

export const FOUNDER_NAV: NavItem[] = [
	{ label: 'Overview', href: '/founder', icon: Home, tone: 'neutral' },
	{ label: 'Startups', href: '/founder/companies', icon: Rocket, tone: 'info' },
	{ label: 'Application', href: '/founder/application', icon: FileText, tone: 'good' },
	{ separator: true as const },
	{ label: 'Job postings', href: '/founder/jobs', icon: Briefcase, tone: 'warn' },
	{ label: 'Applicants', href: '/founder/applicants', icon: UserSearch, tone: 'violet' },
	{ separator: true as const },
	{ label: 'Team', href: '/founder/users', icon: Users, tone: 'info' },
	{ label: 'Details', href: '/founder/settings', icon: Building2, tone: 'info' },
	{ label: 'Activity', href: '/founder/activity', icon: Activity, tone: 'warn' },
	{ separator: true as const },
	{ label: 'Settings', href: '/founder/account', icon: Settings, tone: 'neutral' },
	{ label: 'Support', href: '/founder/support', icon: LifeBuoy, tone: 'neutral' }
];
