// Copies content.json into the site_content table, one row per section.
//
//   node scripts/seed-content.js          insert sections that are not there yet
//   node scripts/seed-content.js --force  overwrite every section from content.json
//
// Run it once after the first deploy. Anything missing from the table is read
// from content.json anyway, so seeding is about making a section editable in the
// console, not about making the site work.
//
// Sections are derived from the shape of content.json — every top-level key, and
// every page under `pages` — so adding a page to the JSON makes it editable here
// without touching this script.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const root = new URL('../', import.meta.url);

const env = Object.fromEntries(
	readFileSync(new URL('.env.local', root), 'utf8')
		.split('\n')
		.filter((line) => line.includes('=') && !line.trim().startsWith('#'))
		.map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()])
);

const content = JSON.parse(readFileSync(new URL('src/lib/data/content.json', root), 'utf8'));

const titleCase = (key) =>
	key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();

const sections = [
	...Object.keys(content)
		.filter((key) => key !== 'pages')
		.map((key) => ({ key, label: titleCase(key), value: content[key] })),
	...Object.keys(content.pages ?? {}).map((key) => ({
		key: `pages.${key}`,
		label: titleCase(key),
		value: content.pages[key]
	}))
];

const admin = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false }
});

const force = process.argv.includes('--force');
const { data: existing } = await admin.from('site_content').select('key');
const present = new Set((existing ?? []).map((row) => row.key));

let written = 0;
for (const section of sections) {
	if (present.has(section.key) && !force) {
		console.log(`skipped  ${section.key} (already stored)`);
		continue;
	}
	const { error } = await admin
		.from('site_content')
		.upsert(
			{ key: section.key, value: section.value, label: section.label },
			{ onConflict: 'key' }
		);
	if (error) console.error(`failed   ${section.key}: ${error.message}`);
	else {
		console.log(`seeded   ${section.key}`);
		written++;
	}
}

console.log(`\n${written} section(s) written, ${sections.length} total.`);
