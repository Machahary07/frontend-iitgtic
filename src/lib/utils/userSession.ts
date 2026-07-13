const KEY = 'tic.user';

export type UserSession = {
	name?: string;
	email?: string;
	phone?: string;
};

export function saveUserSession(patch: Partial<UserSession>) {
	if (typeof sessionStorage === 'undefined') return;
	const current = loadUserSession();
	const merged: UserSession = { ...current, ...patch };
	sessionStorage.setItem(KEY, JSON.stringify(merged));
}

export function loadUserSession(): UserSession {
	if (typeof sessionStorage === 'undefined') return {};
	const raw = sessionStorage.getItem(KEY);
	if (!raw) return {};
	try {
		return JSON.parse(raw) as UserSession;
	} catch {
		return {};
	}
}

export function clearUserSession() {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.removeItem(KEY);
}
