// Sidebar for the TIC team admin. Shared so a new section is added in one place
// rather than in every page's local copy.
//
// `icon` and `tone` are presentation only — AdminShell renders the icon in a
// rounded tinted tile so sections are findable by shape as well as by label.

import Home from '@lucide/svelte/icons/house';
import Building2 from '@lucide/svelte/icons/building-2';
import FileText from '@lucide/svelte/icons/file-text';
import Briefcase from '@lucide/svelte/icons/briefcase';
import UserSearch from '@lucide/svelte/icons/user-search';
import Users from '@lucide/svelte/icons/users';
import Activity from '@lucide/svelte/icons/activity';
import FilePen from '@lucide/svelte/icons/file-pen-line';
import Mail from '@lucide/svelte/icons/mail';
import HardDrive from '@lucide/svelte/icons/hard-drive';
import LifeBuoy from '@lucide/svelte/icons/life-buoy';
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import KeyRound from '@lucide/svelte/icons/key-round';
import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
import Settings from '@lucide/svelte/icons/settings';

import type { NavItem } from '$lib/utils/adminNavTypes';

export const TIC_ADMIN_NAV: NavItem[] = [
	{ label: 'Overview', href: '/tic-admin', icon: Home, tone: 'neutral' },
	// Sits second because it is the queue that holds the public site up: a founder
	// cannot publish anything until someone works through it.
	{ label: 'Approvals', href: '/tic-admin/approvals', icon: ShieldCheck, tone: 'bad' },
	{ label: 'Companies', href: '/tic-admin/companies', icon: Building2, tone: 'info' },
	{ label: 'Applications', href: '/tic-admin/applications', icon: FileText, tone: 'good' },
	{ label: 'Evaluation', href: '/tic-admin/evaluation', icon: ClipboardCheck, tone: 'info' },
	{ label: 'Job postings', href: '/tic-admin/jobs', icon: Briefcase, tone: 'warn' },
	{
		label: 'Job responses',
		href: '/tic-admin/job-applications',
		icon: UserSearch,
		tone: 'violet'
	},
	{ separator: true as const },
	{ label: 'Users', href: '/tic-admin/users', icon: Users, tone: 'info' },
	{ label: 'Roles', href: '/tic-admin/roles', icon: KeyRound, tone: 'violet' },
	{ label: 'Activity', href: '/tic-admin/activity', icon: Activity, tone: 'warn' },
	{ separator: true as const },
	{ label: 'Content', href: '/tic-admin/content', icon: FilePen, tone: 'violet' },
	{ label: 'Email', href: '/tic-admin/email', icon: Mail, tone: 'good' },
	{ label: 'Storage', href: '/tic-admin/storage', icon: HardDrive, tone: 'bad' },
	{ separator: true as const },
	{ label: 'Settings', href: '/tic-admin/settings', icon: Settings, tone: 'neutral' },
	{ label: 'Support', href: '/tic-admin/support', icon: LifeBuoy, tone: 'neutral' }
];
