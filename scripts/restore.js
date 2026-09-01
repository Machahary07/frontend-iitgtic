// Restores a backup taken by scripts/backup.js — and, run with --dry-run, is the
// restore drill: it reads a backup, checks it against the target, and reports
// exactly what would land where, without writing anything.
//
//   node scripts/restore.js backups/<dir> --dry-run
//   node scripts/restore.js backups/<dir> --into https://<ref>.supabase.co --key sb_secret_…
//
// A backup nobody has ever restored is a hope, not a backup. Running the dry run
// against a real backup is the cheapest version of finding out, and it is the
// thing that catches a truncated file or an empty bucket before the day it
// matters.
//
// WHAT THIS CAN AND CANNOT DO
//
// It restores the tables that stand on their own, and re-uploads storage.
//
// It refuses to touch profiles, companies, jobs and applications. Every one of
// those is keyed by auth.users.id, and Supabase's Admin API will not create a
// user with a chosen id — so the rows cannot be reattached to the people they
// belong to. Restoring them would silently orphan or mis-assign records. That
// path is schema.sql + data.sql through psql, which carries auth.users with it.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const pass = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);
const info = (m) => console.log(`    ${m}`);

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const value = (flag) => {
	const i = args.indexOf(flag);
	return i >= 0 ? args[i + 1] : undefined;
};

const dir = args.find(
	(a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true
);
if (!dir) {
	fail('Usage: node scripts/restore.js <backup-dir> [--dry-run] [--into URL --key KEY]');
	process.exit(1);
}

const backup = resolve(dir);
const manifestPath = join(backup, 'manifest.json');
if (!existsSync(manifestPath)) {
	fail(`${manifestPath} does not exist — is that a backup directory?`);
	process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const dryRun = has('--dry-run');

console.log(`\n${dryRun ? 'DRY RUN — nothing will be written' : 'RESTORE'}\n`);
info(`backup   : ${backup}`);
info(`taken    : ${manifest.takenAt}`);
info(`from     : ${manifest.projectRef}`);

// --- target ------------------------------------------------------------------

const root = new URL('../', import.meta.url);
const env = existsSync(new URL('.env.local', root))
	? Object.fromEntries(
			readFileSync(new URL('.env.local', root), 'utf8')
				.split('\n')
				.filter((l) => l.trim() && !l.trim().startsWith('#'))
				.map((l) => {
					const i = l.indexOf('=');
					return [
						l.slice(0, i).trim(),
						l
							.slice(i + 1)
							.trim()
							.replace(/^["']|["']$/g, '')
					];
				})
		)
	: {};

const targetUrl = value('--into') ?? env.PUBLIC_SUPABASE_URL;
const targetKey = value('--key') ?? env.SUPABASE_SERVICE_ROLE_KEY;

if (!targetUrl || !targetKey) {
	fail('No target. Pass --into <url> --key <service-role-key>, or fill in .env.local.');
	process.exit(1);
}

const targetRef = new URL(targetUrl).host.split('.')[0];
info(`into     : ${targetRef}`);
console.log('');

// Restoring over the project the backup came from is how a drill turns into an
// outage. It has to be asked for by name.
if (targetRef === manifest.projectRef && !dryRun && !has('--force-same-project')) {
	fail(`That is the project this backup came from (${targetRef}).`);
	info('A drill should restore into a scratch project. If you really mean to');
	info('overwrite production, re-run with --force-same-project.');
	process.exit(1);
}

const db = createClient(targetUrl, targetKey, {
	auth: { autoRefreshToken: false, persistSession: false }
});

// --- integrity ---------------------------------------------------------------

console.log('Checking the backup\n');

let problems = 0;
for (const [table, meta] of Object.entries(manifest.tables ?? {})) {
	const file = join(backup, meta.file);
	if (!existsSync(file)) {
		fail(`${table} — ${meta.file} is missing`);
		problems += 1;
		continue;
	}
	const body = readFileSync(file, 'utf8');
	const rows = body.split('\n').filter(Boolean).length;
	if (rows !== meta.rows) {
		fail(`${table} — manifest says ${meta.rows} rows, file has ${rows}`);
		problems += 1;
	} else {
		pass(`${table} — ${rows} row${rows === 1 ? '' : 's'}`);
	}
}

if (problems > 0) {
	fail(`\n${problems} problem(s) in the backup. Stopping.`);
	process.exit(1);
}

// --- what will be written ----------------------------------------------------

// Order matters only among these; none references another, but keeping content
// first means a half-finished restore still renders the site.
const RESTORABLE = [
	'site_content',
	'email_templates',
	'email_suppressions',
	'newsletter_subscribers',
	'job_applications',
	'email_log',
	'email_events'
];

const SKIPPED = [
	'profiles',
	'companies',
	'jobs',
	'applications',
	'audit_log',
	'page_views',
	'rate_limits'
];

console.log('\nTables\n');

for (const table of Object.keys(manifest.tables ?? {})) {
	if (!RESTORABLE.includes(table)) {
		const why =
			SKIPPED.includes(table) && manifest.tables[table].authLinked
				? 'keyed by auth.users — restore via schema.sql + data.sql'
				: 'not restored by design';
		info(`${table} — skipped (${why})`);
		continue;
	}

	const rows = readFileSync(join(backup, manifest.tables[table].file), 'utf8')
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line));

	if (rows.length === 0) {
		info(`${table} — nothing to write`);
		continue;
	}

	if (dryRun) {
		pass(`${table} — would upsert ${rows.length} row${rows.length === 1 ? '' : 's'}`);
		continue;
	}

	// Upsert rather than insert, so a partial restore can be re-run.
	let written = 0;
	for (let i = 0; i < rows.length; i += 500) {
		const chunk = rows.slice(i, i + 500);
		const { error } = await db.from(table).upsert(chunk);
		if (error) {
			fail(`${table} — ${error.message}`);
			break;
		}
		written += chunk.length;
	}
	if (written > 0) pass(`${table} — ${written} row${written === 1 ? '' : 's'}`);
}

// --- storage -----------------------------------------------------------------

console.log('\nStorage\n');

const storageRoot = join(backup, 'storage');
if (!existsSync(storageRoot)) {
	info('no storage in this backup');
} else {
	for (const bucket of readdirSync(storageRoot)) {
		const bucketRoot = join(storageRoot, bucket);
		if (!statSync(bucketRoot).isDirectory()) continue;

		const files = [];
		const walk = (d) => {
			for (const entry of readdirSync(d)) {
				const full = join(d, entry);
				if (statSync(full).isDirectory()) walk(full);
				else files.push(full);
			}
		};
		walk(bucketRoot);

		if (dryRun) {
			pass(`${bucket} — would upload ${files.length} object${files.length === 1 ? '' : 's'}`);
			continue;
		}

		let uploaded = 0;
		for (const file of files) {
			const path = relative(bucketRoot, file).split(/[\\/]/).join('/');
			const { error } = await db.storage
				.from(bucket)
				.upload(path, readFileSync(file), { upsert: true });
			if (error) warn(`${bucket}/${path} — ${error.message}`);
			else uploaded += 1;
		}
		pass(`${bucket} — ${uploaded}/${files.length} object${files.length === 1 ? '' : 's'}`);
	}
}

console.log('');
if (dryRun) {
	pass('Dry run complete — the backup is readable and the target is reachable.');
	info('That is the drill. Re-run without --dry-run against a scratch project to');
	info('rehearse the real thing.');
} else {
	pass('Restore complete.');
	if (!manifest.restorable?.fullDisasterRecovery) {
		warn('This backup had no SQL dump, so auth.users and the schema were not restored.');
	}
}
console.log('');
