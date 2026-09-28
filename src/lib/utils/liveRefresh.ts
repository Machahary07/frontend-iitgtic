import { invalidateAll } from '$app/navigation';
import { navigating } from '$app/state';

// Keeps a console current without anyone reaching for reload.
//
// Every page's figures come from its server load, so re-running the loads is
// the one mechanism that refreshes all of them at once: a new application, a
// company verified by a colleague, a changed count in the sidebar. It happens
//   - every INTERVAL while the tab is in view,
//   - the moment the tab comes back into view or the window regains focus,
// and never while the person is mid-way through something — typing, or with a
// dialog open — so a refresh cannot yank a half-filled form out from under them.
//
// (Supabase Realtime would push instead of pull, but these tables are
// service-role only by design, so a browser has no channel to listen on.)

const INTERVAL_MS = 15_000;

function busy(): boolean {
	if (navigating.to) return true;
	if (document.querySelector('dialog[open], [role="dialog"]')) return true;
	const active = document.activeElement;
	if (!active) return false;
	if (active instanceof HTMLTextAreaElement) return true;
	if (active instanceof HTMLSelectElement) return true;
	if (active instanceof HTMLInputElement) {
		return !['button', 'submit', 'checkbox', 'radio', 'reset'].includes(active.type);
	}
	return (active as HTMLElement).isContentEditable;
}

/** Starts refreshing; returns the function that stops it. */
export function liveRefresh(): () => void {
	let running = false;
	let last = Date.now();

	async function refresh() {
		if (running || document.visibilityState !== 'visible' || busy()) return;
		running = true;
		try {
			await invalidateAll();
			last = Date.now();
		} finally {
			running = false;
		}
	}

	const timer = setInterval(refresh, INTERVAL_MS);

	// Coming back to the tab after a while is exactly when the page is stalest.
	const onReturn = () => {
		if (document.visibilityState === 'visible' && Date.now() - last > 3_000) refresh();
	};
	document.addEventListener('visibilitychange', onReturn);
	window.addEventListener('focus', onReturn);

	return () => {
		clearInterval(timer);
		document.removeEventListener('visibilitychange', onReturn);
		window.removeEventListener('focus', onReturn);
	};
}
