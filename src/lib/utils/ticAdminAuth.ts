// Mock TIC team admin auth.
// Password comes from the PUBLIC_TIC_ADMIN_PASSWORD env var (checked client-side,
// so it is visible in the bundle) — replace with Supabase when wired.

import { PUBLIC_TIC_ADMIN_PASSWORD } from '$env/static/public';

const SESSION_KEY = 'tic.admin.session';
const ADMIN_PASSWORD = PUBLIC_TIC_ADMIN_PASSWORD;

function isBrowser() {
	return typeof localStorage !== 'undefined';
}

export function loginTicAdmin(password: string): { ok: true } | { ok: false; error: string } {
	if (password !== ADMIN_PASSWORD) {
		return { ok: false, error: 'Incorrect password.' };
	}
	if (isBrowser()) {
		localStorage.setItem(SESSION_KEY, '1');
	}
	return { ok: true };
}

export function logoutTicAdmin() {
	if (!isBrowser()) return;
	localStorage.removeItem(SESSION_KEY);
}

export function isTicAdminAuthed(): boolean {
	if (!isBrowser()) return false;
	return localStorage.getItem(SESSION_KEY) === '1';
}
