// The browser half of "view as" — see $lib/server/viewAs for the rules.
//
// Both steps end in a full page load rather than a client-side goto: every
// layout above the page has to re-run as the new identity, and a hard load is
// the one way to be sure nothing from the previous one is still on screen.

export type ViewAsAccount = {
	id: string;
	name: string;
	email: string;
	role: string;
	roleLabel: string;
};

async function go(init: RequestInit): Promise<{ ok: true } | { ok: false; error: string }> {
	try {
		const res = await fetch('/api/tic-admin/view-as', {
			...init,
			headers: { 'content-type': 'application/json' }
		});
		const body = (await res.json().catch(() => ({}))) as { redirect?: string; message?: string };
		if (!res.ok) return { ok: false, error: body.message ?? 'Could not switch accounts.' };
		window.location.assign(body.redirect ?? '/tic-admin');
		return { ok: true };
	} catch {
		return { ok: false, error: 'Could not reach the server. Please try again.' };
	}
}

export function viewAs(userId: string) {
	return go({ method: 'POST', body: JSON.stringify({ userId }) });
}

export function exitViewAs() {
	return go({ method: 'DELETE' });
}

export async function searchViewAs(query: string, role: string | null): Promise<ViewAsAccount[]> {
	const params = new URLSearchParams({ q: query });
	if (role) params.set('role', role);
	const res = await fetch(`/api/tic-admin/view-as?${params}`);
	if (!res.ok) return [];
	const body = (await res.json().catch(() => ({}))) as { accounts?: ViewAsAccount[] };
	return body.accounts ?? [];
}
