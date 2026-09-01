import { env } from '$env/dynamic/private';

// What Resend actually says about the sending domain.
//
// `usingTestSender` was inferred from the From address containing "resend.dev".
// That answers "are we obviously on the sandbox", not "will a message to a real
// person arrive" — a From address on an unverified domain looks perfectly fine
// by that test and still gets rejected at send time.
//
// This asks Resend. It is the difference between the console saying "the domain
// is not verified" and the console saying which DNS records are still missing.

const ENDPOINT = 'https://api.resend.com/domains';

export type DomainRecord = {
	record: string;
	name: string;
	type: string;
	value: string;
	ttl?: string;
	priority?: number;
	status?: string;
};

export type DomainStatus =
	// The From address is on resend.dev — Resend delivers those only to the
	// account that owns the API key.
	| { state: 'sandbox'; domain: string }
	// No RESEND_API_KEY, so there is nothing to ask.
	| { state: 'unconfigured'; domain: string }
	// The domain is not registered with Resend at all.
	| { state: 'not-added'; domain: string }
	| { state: 'verified'; domain: string; records: DomainRecord[] }
	| { state: 'pending'; domain: string; records: DomainRecord[] }
	| { state: 'failed'; domain: string; records: DomainRecord[]; detail: string }
	// Resend could not be reached; not the same as "not verified".
	| { state: 'unknown'; domain: string; detail: string };

/** `IIT Guwahati TIC <no-reply@example.org>` → `example.org` */
export function domainOf(from: string): string {
	const match = /<([^>]+)>/.exec(from);
	const address = (match?.[1] ?? from).trim();
	return address.split('@').pop()?.trim().toLowerCase() ?? '';
}

type ListRow = { id?: string; name?: string; status?: string };

async function resend(path: string, apiKey: string): Promise<unknown> {
	const res = await fetch(`${ENDPOINT}${path}`, {
		headers: { authorization: `Bearer ${apiKey}` }
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { message?: string };
		throw new Error(body.message || `Resend returned ${res.status}.`);
	}
	return res.json();
}

// One admin screen reads this, so a short cache is enough to stop a refresh
// spending an API call, without hiding a verification that just went through.
const TTL_MS = 60_000;
let cache: { at: number; value: DomainStatus } | null = null;

export function invalidateDomainStatus(): void {
	cache = null;
}

export async function domainStatus(from: string): Promise<DomainStatus> {
	const domain = domainOf(from);

	if (domain.endsWith('resend.dev')) return { state: 'sandbox', domain };

	const apiKey = env.RESEND_API_KEY?.trim();
	if (!apiKey) return { state: 'unconfigured', domain };

	if (cache && Date.now() - cache.at < TTL_MS && cache.value.domain === domain) {
		return cache.value;
	}

	let value: DomainStatus;
	try {
		const list = (await resend('', apiKey)) as { data?: ListRow[] };
		const match = (list.data ?? []).find((row) => row.name?.toLowerCase() === domain);

		if (!match?.id) {
			value = { state: 'not-added', domain };
		} else {
			// The list response carries the status but not the DNS records; the
			// detail call is what can tell somebody what is still missing.
			const detail = (await resend(`/${match.id}`, apiKey)) as {
				status?: string;
				records?: DomainRecord[];
			};
			const records = detail.records ?? [];
			const state = (detail.status ?? match.status ?? '').toLowerCase();

			if (state === 'verified') value = { state: 'verified', domain, records };
			else if (state === 'failed' || state === 'temporary_failure') {
				value = { state: 'failed', domain, records, detail: state.replace(/_/g, ' ') };
			} else value = { state: 'pending', domain, records };
		}
	} catch (err) {
		// A network problem is not evidence the domain is unverified, and saying so
		// would send somebody to fix DNS that is already correct.
		value = { state: 'unknown', domain, detail: err instanceof Error ? err.message : String(err) };
	}

	cache = { at: Date.now(), value };
	return value;
}

/** One line for the console banner and the doctor script. */
export function describeDomain(status: DomainStatus): string {
	switch (status.state) {
		case 'sandbox':
			return 'Sending from the Resend sandbox — messages reach only the address that owns the API key.';
		case 'unconfigured':
			return 'RESEND_API_KEY is not set, so nothing is delivered.';
		case 'not-added':
			return `${status.domain} has not been added to Resend yet.`;
		case 'verified':
			return `${status.domain} is verified — mail is delivered normally.`;
		case 'pending':
			return `${status.domain} is added but not verified yet. Until it is, sending fails.`;
		case 'failed':
			return `${status.domain} failed verification (${status.detail}). Check the DNS records below.`;
		case 'unknown':
			return `Could not reach Resend to check ${status.domain} — ${status.detail}`;
	}
}
