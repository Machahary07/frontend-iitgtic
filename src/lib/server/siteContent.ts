import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import fallback from '$lib/data/content.json';
import { readPath, writePath, type SiteContent } from '$lib/content';

// Assembles the live content document from site_content, falling back to
// content.json for anything not stored yet.
//
// The result is identical for every visitor, so it is cached in the running
// process rather than fetched per request. Saving from the admin console clears
// the cache, so an edit is visible on the next page load rather than after a TTL.

const TTL_MS = 60_000;

let cached: SiteContent | null = null;
let cachedAt = 0;
let inflight: Promise<SiteContent> | null = null;

export function invalidateSiteContent(): void {
	cached = null;
	cachedAt = 0;
}

async function fetchContent(): Promise<SiteContent> {
	const { data, error } = await supabaseAdmin.from('site_content').select('key, value');

	// A database problem must never take the public site down — the bundled copy
	// is a complete, valid document on its own.
	if (error || !data) return fallback as SiteContent;

	const doc = structuredClone(fallback) as unknown as Record<string, unknown>;
	for (const row of data) {
		writePath(doc, row.key as string, row.value);
	}
	return doc as unknown as SiteContent;
}

export async function getSiteContent(): Promise<SiteContent> {
	if (cached && Date.now() - cachedAt < TTL_MS) return cached;
	if (inflight) return inflight;

	inflight = fetchContent()
		.then((doc) => {
			cached = doc;
			cachedAt = Date.now();
			return doc;
		})
		.finally(() => {
			inflight = null;
		});

	return inflight;
}

// One section, for the admin editor. Reads through to content.json so a section
// that has never been saved still opens with its current values.
export async function getSection(key: string): Promise<unknown> {
	const { data } = await supabaseAdmin
		.from('site_content')
		.select('value')
		.eq('key', key)
		.maybeSingle();

	return data?.value ?? readPath(fallback, key);
}
