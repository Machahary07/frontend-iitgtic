// Where Supabase sends someone after they click a link in an auth email.
//
// Supabase only falls back to the project's Site URL when the call that sent the
// mail gave it no `emailRedirectTo` — which is how a confirmation link ends up
// pointing at http://localhost:3000, the dashboard default. Every auth call that
// can send mail goes through here instead, so the link comes back to the origin
// the person actually signed up on.
//
// The URL still has to be on the project's allow-list (Dashboard →
// Authentication → URL Configuration → Redirect URLs). If it is not, Supabase
// drops it without an error and uses the Site URL anyway.

import { browser } from '$app/environment';
import { env as publicEnv } from '$env/dynamic/public';

export const AUTH_CALLBACK_PATH = '/auth/callback';

// Where each flow lands once the callback has a live session.
export const AFTER_COMPANY_SIGNUP = '/opportunities/job-posting-admin';
export const AFTER_FOUNDER_SIGNUP = '/application';
// A recovery link carries a session like any other, so it lands on the callback
// too — and is then forwarded to the one page that can spend it.
export const AFTER_PASSWORD_RESET = '/auth/reset-password';

function siteOrigin(): string {
	if (browser) return window.location.origin;
	return (publicEnv.PUBLIC_SITE_URL?.trim() || 'https://iitgtic.itsjeu.com').replace(/\/$/, '');
}

export function authCallbackUrl(next: string): string {
	const url = new URL(AUTH_CALLBACK_PATH, siteOrigin());
	url.searchParams.set('next', next);
	return url.toString();
}

// `next` arrives from a URL, so it is only ever a path on this site — an
// absolute or protocol-relative value would turn the callback into an open
// redirect.
export function safeNext(value: string | null, fallback: string): string {
	if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
	return value;
}
