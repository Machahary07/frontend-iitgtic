// One-off content migration for the Schemes & Programs / Opportunities menu change.
//
//   node scripts/migrate-nav-menus.js --dry-run   show what would change
//   node scripts/migrate-nav-menus.js             apply it
//
// Why this exists rather than `seed-content.js --force`: the sections being
// changed (nav, footer, pages.about, pages.opportunities) are already stored in
// site_content and carry edits made in the admin console that content.json does
// not have. So every change here starts from the STORED value and applies only
// the structural edit the menu change needs. Nothing else is touched.
//
// The startup job board is the one real data move: the roles that used to live
// under pages.opportunities.posts now belong to pages.startupJobs, and they are
// carried across from the stored row so console-added postings survive.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const root = new URL('../', import.meta.url);
const env = Object.fromEntries(
	readFileSync(new URL('.env.local', root), 'utf8')
		.split('\n')
		.filter((line) => line.includes('=') && !line.trim().startsWith('#'))
		.map((line) => [
			line.slice(0, line.indexOf('=')).trim(),
			line.slice(line.indexOf('=') + 1).trim()
		])
);

const content = JSON.parse(readFileSync(new URL('src/lib/data/content.json', root), 'utf8'));
const dryRun = process.argv.includes('--dry-run');

const admin = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false }
});

const { data: rows, error } = await admin.from('site_content').select('key, value, label');
if (error) {
	console.error(`could not read site_content: ${error.message}`);
	process.exit(1);
}
const stored = new Map(rows.map((r) => [r.key, r]));

// Falls back to the bundled copy for a section that was never seeded.
const live = (key) =>
	structuredClone(stored.get(key)?.value ?? key.split('.').reduce((n, p) => n?.[p], content));

// Inserts `item` after the entry whose `field` matches `after`, and removes any
// earlier copy so the script is safe to run twice.
function insertAfter(list, field, after, item) {
	const without = list.filter((x) => x[field] !== item[field]);
	const at = without.findIndex((x) => x[field] === after);
	without.splice(at === -1 ? without.length : at + 1, 0, item);
	return without;
}

const writes = [];

// ── nav ───────────────────────────────────────────────────────────────────
const nav = live('nav');
nav.leftLinks[0].dropdown = insertAfter(nav.leftLinks[0].dropdown, 'label', 'TIC Team', {
	label: 'TIC Coordinators',
	href: '/about/tic-coordinators'
});
nav.rightLinks = content.nav.rightLinks;
writes.push({ key: 'nav', label: 'Navigation', value: nav });

// ── footer ────────────────────────────────────────────────────────────────
const footer = live('footer');
for (const group of footer.linkGroups) {
	if (group.title === 'Resources') {
		group.links = insertAfter(group.links, 'label', 'Events & Workshops', {
			label: 'Schemes',
			href: '/schemes'
		});
	}
	if (group.title === 'Company') {
		group.links = insertAfter(group.links, 'label', 'TIC Team', {
			label: 'TIC Coordinators',
			href: '/about/tic-coordinators'
		});
	}
}
writes.push({ key: 'footer', label: 'Footer', value: footer });

// ── pages.about ───────────────────────────────────────────────────────────
const about = live('pages.about');
about.links = insertAfter(
	about.links,
	'href',
	'/about/team',
	content.pages.about.links.find((l) => l.href === '/about/tic-coordinators')
);
writes.push({ key: 'pages.about', label: 'About', value: about });

// ── pages.startupJobs ─────────────────────────────────────────────────────
// The old board, lifted whole out of pages.opportunities so its copy and every
// posting come across exactly as they are live today.
const oldBoard = live('pages.opportunities');
writes.push({
	key: 'pages.startupJobs',
	label: 'Startup jobs',
	value: {
		heading: 'Startup Jobs',
		title: 'Startup Jobs · IITG TIC',
		hero: oldBoard.hero,
		listEyebrow: oldBoard.listEyebrow ?? content.pages.startupJobs.listEyebrow,
		emptyMessage: oldBoard.emptyMessage ?? content.pages.startupJobs.emptyMessage,
		posts: oldBoard.posts ?? content.pages.startupJobs.posts
	}
});

// ── the sections that are new or wholly replaced ──────────────────────────
writes.push({
	key: 'pages.opportunities',
	label: 'Opportunities',
	value: content.pages.opportunities
});
writes.push({ key: 'pages.ticJobs', label: 'TIC jobs', value: content.pages.ticJobs });
writes.push({ key: 'pages.programs', label: 'Schemes & programs', value: content.pages.programs });
writes.push({ key: 'pages.schemes', label: 'Schemes', value: content.pages.schemes });
writes.push({
	key: 'pages.ticCoordinators',
	label: 'TIC coordinators',
	value: content.pages.ticCoordinators
});

for (const w of writes) {
	const before = stored.get(w.key)?.value;
	const unchanged = JSON.stringify(before) === JSON.stringify(w.value);
	const state = before === undefined ? 'new' : unchanged ? 'unchanged' : 'updated';
	const extra =
		w.key === 'pages.startupJobs' ? ` (${w.value.posts.length} posting(s) carried over)` : '';
	console.log(`${dryRun ? 'would write' : 'writing'}  ${w.key.padEnd(24)} ${state}${extra}`);

	if (dryRun || unchanged) continue;
	const { error: writeError } = await admin
		.from('site_content')
		.upsert({ key: w.key, value: w.value, label: w.label }, { onConflict: 'key' });
	if (writeError) console.error(`  failed: ${writeError.message}`);
}

console.log(
	dryRun
		? '\nDry run — nothing written. Re-run without --dry-run to apply.'
		: '\nDone. The site picks the new content up within a minute, or immediately on the next admin save.'
);
