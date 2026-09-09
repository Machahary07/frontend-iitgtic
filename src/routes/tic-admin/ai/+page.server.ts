import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Only whether a shared key is configured, never the key itself. The console
	// uses it to decide whether to insist on a personal key or to offer the
	// deployment's own as the default.
	return { hasServerKey: Boolean(env.SARVAM_API_KEY?.trim()) };
};
