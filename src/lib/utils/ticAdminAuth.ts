// TIC team admin auth. The password lives in the server-only TIC_ADMIN_PASSWORD
// env var and is checked by /api/tic-admin-login — it never reaches the browser.

const SESSION_KEY = 'tic.admin.session';

function isBrowser() {
	return typeof localStorage !== 'undefined';
}

export async function loginTicAdmin(
	password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	let valid = false;
	try {
		const res = await fetch('/api/tic-admin-login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ password })
		});
		valid = res.ok && ((await res.json()) as { ok?: boolean }).ok === true;
	} catch {
		return { ok: false, error: 'Could not reach the server. Please try again.' };
	}
	if (!valid) {
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
