// Shape of a sidebar entry for AdminShell. Kept out of the nav files themselves
// so both the TIC admin and the company portal describe their sidebars the same way.

import type { Component } from 'svelte';

// Matches the tint keys in $styles/admin's $admin-tones map.
export type AdminNavTone = 'good' | 'warn' | 'bad' | 'info' | 'violet' | 'neutral';

export type NavLink = {
	label: string;
	href: string;
	icon?: Component<Record<string, unknown>>;
	tone?: AdminNavTone;
};

export type NavItem = NavLink | { separator: true };
