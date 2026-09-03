// Checks that .env.local can actually talk to Supabase, and says which line is
// wrong when it cannot.
//
//   node scripts/doctor.js     (or: pnpm run doctor)
//
// Written for the case where the console shows "Create the first admin" on a
// machine that should already have one — that screen appears whenever the admin
// lookup fails, so this prints the reason the UI cannot.

import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const root = new URL('../', import.meta.url);
const envPath = new URL('.env.local', root);

const pass = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);

let problems = 0;
const bad = (m) => {
	problems += 1;
	fail(m);
};

console.log('\nChecking .env.local\n');

if (!existsSync(envPath)) {
	bad('.env.local does not exist. Copy .env.example to .env.local and fill it in.');
	process.exit(1);
}

const env = Object.fromEntries(
	readFileSync(envPath, 'utf8')
		.split('\n')
		.filter((line) => line.trim() && !line.trim().startsWith('#'))
		.map((line) => {
			const i = line.indexOf('=');
			return [
				line.slice(0, i).trim(),
				line
					.slice(i + 1)
					.trim()
					.replace(/^["']|["']$/g, '')
			];
		})
);

const REQUIRED = [
	'PUBLIC_SUPABASE_URL',
	'PUBLIC_SUPABASE_PUBLISHABLE_KEY',
	'SUPABASE_SERVICE_ROLE_KEY',
	'ADMIN_SESSION_SECRET',
	'TIC_ADMIN_PASSWORD',
	'PUBLIC_TURNSTILE_SITE_KEY',
	'TURNSTILE_SECRET_KEY'
];

for (const key of REQUIRED) {
	if (!env[key]) bad(`${key} is missing`);
}
if (problems) {
	console.log('\nFill those in, then run this again.\n');
	process.exit(1);
}
pass(`all ${REQUIRED.length} required keys are present`);

const url = env.PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

// The single most common mistake: pasting the publishable key into the secret
// slot. Both are valid keys, so the failure only shows up as an empty result.
if (service === env.PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
	bad('SUPABASE_SERVICE_ROLE_KEY is the same value as PUBLIC_SUPABASE_PUBLISHABLE_KEY');
} else if (service.startsWith('sb_publishable_')) {
	bad('SUPABASE_SERVICE_ROLE_KEY holds a publishable key. Use the secret key (sb_secret_…).');
} else if (!service.startsWith('sb_secret_') && !service.startsWith('eyJ')) {
	warn('SUPABASE_SERVICE_ROLE_KEY is in an unfamiliar format — expected sb_secret_… ');
} else {
	pass('service role key looks like a secret key');
}

// Email is optional, so a missing key is a note rather than a failure — the app
// degrades to recording every message as blocked.
if (!env.RESEND_API_KEY) {
	warn('RESEND_API_KEY is not set — mail is rendered and logged, but never delivered');
} else if (!env.RESEND_API_KEY.startsWith('re_')) {
	warn('RESEND_API_KEY is in an unfamiliar format — expected re_…');
} else if (!env.RESEND_FROM || env.RESEND_FROM.includes('resend.dev')) {
	warn('RESEND_FROM is the Resend sandbox sender — it only reaches the API key owner');
} else {
	pass('Resend key and From address are set');

	// Ask Resend rather than guess. A From address on an unverified domain looks
	// perfectly fine to the check above and is still refused at send time.
	const domain = (/<([^>]+)>/.exec(env.RESEND_FROM)?.[1] ?? env.RESEND_FROM)
		.trim()
		.split('@')
		.pop()
		?.toLowerCase();

	try {
		const res = await fetch('https://api.resend.com/domains', {
			headers: { authorization: `Bearer ${env.RESEND_API_KEY}` }
		});
		if (!res.ok) {
			warn(`could not ask Resend about ${domain} — it returned ${res.status}`);
		} else {
			const body = await res.json();
			const match = (body.data ?? []).find((row) => row.name?.toLowerCase() === domain);
			if (!match) {
				bad(`${domain} has not been added to Resend — real mail will not be delivered`);
			} else if ((match.status ?? '').toLowerCase() === 'verified') {
				pass(`${domain} is verified in Resend`);
			} else {
				bad(`${domain} is in Resend but not verified (${match.status}) — sending will fail`);
			}
		}
	} catch (err) {
		warn(`could not reach Resend to check ${domain} — ${err.message}`);
	}
}

let host;
try {
	host = new URL(url).host;
	pass(`project URL parses — ${host}`);
} catch {
	bad(`PUBLIC_SUPABASE_URL is not a valid URL: ${url}`);
	process.exit(1);
}

console.log('\nTalking to Supabase\n');

const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

let admins = null;
try {
	const { count, error } = await db
		.from('profiles')
		.select('id', { count: 'exact', head: true })
		.eq('role', 'admin');
	if (error) {
		bad(
			`the profiles table rejected the request — ${error.message || error.code || 'no detail'}. ` +
				'The service role key is probably wrong, or belongs to a different project.'
		);
	} else {
		admins = count ?? 0;
		pass(`reached ${host} and read the profiles table`);
	}
} catch (err) {
	bad(`could not reach ${host} — ${err.message}. Check the URL and your network.`);
}

if (admins !== null) {
	if (admins === 0) {
		warn('no admin account exists yet — the setup screen is correct, this really is a first run');
	} else {
		const s = admins === 1 ? ' exists' : 's exist';
		pass(`${admins} admin account${s} — the sign-in form should show`);
	}

	const { count: sections, error: contentError } = await db
		.from('site_content')
		.select('key', { count: 'exact', head: true });
	if (contentError) {
		bad(
			`site_content is not readable — have the migrations been pushed? (${contentError.message})`
		);
	} else if (!sections) {
		warn('site_content is empty — run: node scripts/seed-content.js');
	} else {
		pass(`${sections} editable content sections`);
	}

	// Storage is the half a schema check never covers: the tables can be perfect
	// while an upload still fails, because a bucket lives outside the migration's
	// reach if it was never pushed. Missing buckets only ever surface as a 500 in
	// the console, so ask for them by name here instead.
	const BUCKETS = {
		'application-documents': false,
		'job-applications': false,
		'email-assets': true,
		'site-assets': true
	};

	const { data: buckets, error: bucketError } = await db.storage.listBuckets();
	if (bucketError) {
		bad(`could not list storage buckets — ${bucketError.message}`);
	} else {
		const found = new Map((buckets ?? []).map((b) => [b.name, b]));
		for (const [name, shouldBePublic] of Object.entries(BUCKETS)) {
			const bucket = found.get(name);
			if (!bucket) {
				bad(`storage bucket "${name}" is missing — run: supabase db push`);
			} else if (bucket.public !== shouldBePublic) {
				bad(
					`storage bucket "${name}" is ${bucket.public ? 'public' : 'private'}, expected ` +
						`${shouldBePublic ? 'public' : 'private'}`
				);
			}
		}
		if (!problems)
			pass(`all ${Object.keys(BUCKETS).length} storage buckets exist, public flags correct`);
	}
}

if (problems) {
	console.log(`\n\x1b[31m${problems} problem${problems === 1 ? '' : 's'} found.\x1b[0m`);
	console.log('Fix the lines above, then restart the dev server — env is read at startup.\n');
	process.exit(1);
}
console.log('\n\x1b[32mEnvironment looks good.\x1b[0m\n');
