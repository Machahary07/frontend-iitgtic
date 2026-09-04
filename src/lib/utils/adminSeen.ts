// One-time notices in the admin console — messages worth reading once per login
// and not again. Each is stored under this prefix so signing out can clear the
// whole set without every notice having to announce its own key here.

export const ADMIN_SEEN_PREFIX = 'tic-admin:seen:';

export function clearAdminSeenFlags(): void {
	try {
		for (const key of Object.keys(localStorage)) {
			if (key.startsWith(ADMIN_SEEN_PREFIX)) localStorage.removeItem(key);
		}
	} catch {
		// Storage blocked: nothing was written, so there is nothing to clear.
	}
}
