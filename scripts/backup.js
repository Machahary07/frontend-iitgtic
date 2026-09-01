// Takes a backup of everything the app owns.
//
//   node scripts/backup.js            (or: pnpm backup)
//   node scripts/backup.js --full     include the high-volume audit tables
//   node scripts/backup.js --no-storage
//
// Two halves, because no single tool covers both:
//
//   1. The database. A pg_dump captures the schema, the roles and auth.users,
//      which is what a disaster recovery actually needs. `supabase db dump`
//      always runs pg_dump inside Docker, so it fails on a machine without the
//      daemon even when pg_dump is installed natively. This script therefore
//      prefers a local pg_dump over the CLI and only falls back to it. When
//      neither route works it says so and keeps going, because half a backup
//      beats none.
//
//   2. Storage. pg_dump never covers this: Supabase Storage keeps the objects in
//      S3 and only the metadata rows in Postgres, so a database-only backup of
//      this project restores rows pointing at resumes and pitch decks that are
//      gone. Nothing but a script can fetch them.
//
// The table export alongside is a readable archive — one NDJSON file per table —
// and the fallback when the SQL dump cannot run. Read RESTORING below for what
// it can and cannot put back.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = new URL('../', import.meta.url);
const pass = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);
const info = (m) => console.log(`    ${m}`);

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const value = (flag, fallback) => {
	const i = args.indexOf(flag);
	return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

// --- environment -------------------------------------------------------------

const envPath = new URL('.env.local', root);
if (!existsSync(envPath)) {
	fail('.env.local does not exist. Copy .env.example and fill it in.');
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

for (const key of ['PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
	if (!env[key]) {
		fail(`${key} is missing from .env.local`);
		process.exit(1);
	}
}

const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false }
});
const projectRef = new URL(env.PUBLIC_SUPABASE_URL).host.split('.')[0];

// --- what to take ------------------------------------------------------------

// `volatile` tables grow without bound and are worth little in a restore — the
// rate limiter rebuilds itself, and page views are analytics rather than record.
// They are skipped unless --full.
const TABLES = [
	{ name: 'profiles', authLinked: true },
	{ name: 'companies', authLinked: true },
	{ name: 'jobs', authLinked: true },
	{ name: 'applications', authLinked: true },
	{ name: 'job_applications', authLinked: false },
	{ name: 'site_content', authLinked: false },
	{ name: 'email_templates', authLinked: false },
	{ name: 'email_log', authLinked: false },
	{ name: 'email_events', authLinked: false },
	{ name: 'email_suppressions', authLinked: false },
	{ name: 'newsletter_subscribers', authLinked: false },
	{ name: 'audit_log', authLinked: false, volatile: true },
	{ name: 'page_views', authLinked: false, volatile: true },
	{ name: 'rate_limits', authLinked: false, volatile: true }
];

const BUCKETS = ['application-documents', 'job-applications', 'email-assets'];

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outRoot = value('--out', join(process.cwd(), 'backups'));
const dir = join(outRoot, `${projectRef}-${stamp}`);
mkdirSync(dir, { recursive: true });

console.log(`\nBacking up ${projectRef} → ${dir}\n`);

const manifest = {
	takenAt: new Date().toISOString(),
	projectRef,
	includesVolatile: has('--full'),
	tables: {},
	storage: {},
	sqlDump: null,
	restorable: {}
};

// --- 1. the SQL dump, when the tooling is here -------------------------------

console.log('Database (pg_dump)\n');

// Homebrew keeps libpq off the default PATH because it would shadow the
// system psql, so an installed pg_dump is invisible to a plain spawn.
const PG_DIRS = [
	'/opt/homebrew/opt/libpq/bin',
	'/usr/local/opt/libpq/bin',
	'/opt/homebrew/bin',
	'/usr/local/bin'
];

function findPgDump() {
	try {
		return execFileSync('sh', ['-c', 'command -v pg_dump'], { stdio: 'pipe' }).toString().trim();
	} catch {
		/* not on PATH — look in the usual Homebrew prefixes below */
	}
	for (const d of PG_DIRS) {
		const candidate = join(d, 'pg_dump');
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

// The direct host takes a plain `postgres` user; the poolers want the project
// ref appended and do not accept a dump connection on every plan.
function connectionString() {
	const ref = projectRef;
	const password = env.IITG_SUPABASE_PASSWORD ?? '';
	if (!ref || !password) return null;
	return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres?sslmode=require`;
}

const pgDump = findPgDump();
const conn = connectionString();

// Supabase owns these schemas itself and their contents are recreated by the
// platform, not by a restore. Dumping them produces noise that fails on the way
// back in. auth and storage are kept: auth.users is the point of the exercise.
const EXCLUDED_SCHEMAS = [
	'extensions',
	'graphql',
	'graphql_public',
	'pgbouncer',
	'realtime',
	'supabase_functions',
	'supabase_migrations',
	'vault',
	'pgsodium',
	'pgsodium_masks',
	'net',
	'cron'
];

function nativeDump(label, extraArgs, file) {
	const target = join(dir, file);
	try {
		execFileSync(
			pgDump,
			[
				conn,
				'--no-owner',
				'--no-privileges',
				'--quote-all-identifiers',
				...EXCLUDED_SCHEMAS.flatMap((s) => ['--exclude-schema', s]),
				...extraArgs,
				'-f',
				target
			],
			{ stdio: 'pipe', env: { ...process.env, PGCONNECT_TIMEOUT: '20' } }
		);
		const bytes = readFileSync(target).length;
		pass(`${label} → ${file} (${(bytes / 1024).toFixed(0)} KB)`);
		return { file, bytes };
	} catch (err) {
		const detail = [err.stderr, err.stdout, err.message]
			.map((part) => (part ? String(part) : ''))
			.join('\n')
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean)
			.pop();
		warn(`${label} failed — ${detail ?? 'no detail'}`);
		return null;
	}
}

function cliDump(label, extraArgs, file) {
	const target = join(dir, file);
	try {
		execFileSync('supabase', ['db', 'dump', '--linked', ...extraArgs, '-f', target], {
			stdio: 'pipe',
			env: { ...process.env, SUPABASE_DB_PASSWORD: env.IITG_SUPABASE_PASSWORD ?? '' }
		});
		const bytes = readFileSync(target).length;
		pass(`${label} → ${file} (${(bytes / 1024).toFixed(0)} KB)`);
		return { file, bytes };
	} catch (err) {
		// The CLI reports its progress on stdout and the real failure on either
		// stream, so both have to be read — checking stderr alone reports the
		// progress line as if it were the error.
		const message = [err.stderr, err.stdout, err.message]
			.map((part) => (part ? String(part) : ''))
			.join('\n');

		if (/docker/i.test(message)) throw new Error('no-docker', { cause: err });

		const detail =
			message
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith('Dumping'))
				.pop() ?? 'no detail';
		warn(`${label} failed — ${detail}`);
		return null;
	}
}

if (pgDump && conn) {
	info(`using ${pgDump}`);
	manifest.sqlDump = {
		via: 'pg_dump',
		schema: nativeDump('schema + roles', ['--schema-only'], 'schema.sql'),
		data: nativeDump('data', ['--data-only', '--column-inserts'], 'data.sql')
	};
} else {
	if (!pgDump) info('no local pg_dump — falling back to supabase db dump (needs Docker)');
	if (!conn) info('IITG_SUPABASE_PASSWORD is not set — falling back to supabase db dump');
	try {
		manifest.sqlDump = {
			via: 'supabase-cli',
			schema: cliDump('schema + roles', [], 'schema.sql'),
			data: cliDump('data', ['--data-only', '--use-copy'], 'data.sql')
		};
	} catch (err) {
		if (err.message === 'no-docker') {
			warn('supabase db dump needs Docker, and no local pg_dump was found either');
			info('Without one this backup cannot capture auth.users, the schema or the roles.');
			info('Run `brew install libpq`, or start Docker Desktop, and run this again.');
			manifest.sqlDump = { unavailable: 'pg_dump not runnable on this machine' };
		} else {
			throw err;
		}
	}
}

// --- 2. tables, as a readable archive ----------------------------------------

console.log('\nTables\n');

const PAGE = 1000;

async function dumpTable(table) {
	const lines = [];
	for (let from = 0; ; from += PAGE) {
		const { data, error } = await db
			.from(table)
			.select('*')
			.range(from, from + PAGE - 1);

		if (error) {
			warn(`${table} — ${error.message}`);
			return null;
		}
		if (!data || data.length === 0) break;
		for (const row of data) lines.push(JSON.stringify(row));
		if (data.length < PAGE) break;
	}

	const body = lines.length > 0 ? `${lines.join('\n')}\n` : '';
	const file = `tables/${table}.ndjson`;
	mkdirSync(join(dir, 'tables'), { recursive: true });
	writeFileSync(join(dir, file), body);

	return {
		file,
		rows: lines.length,
		bytes: Buffer.byteLength(body),
		sha256: createHash('sha256').update(body).digest('hex')
	};
}

for (const table of TABLES) {
	if (table.volatile && !has('--full')) {
		info(`${table.name} — skipped (use --full to include)`);
		continue;
	}
	const result = await dumpTable(table.name);
	if (result) {
		manifest.tables[table.name] = { ...result, authLinked: Boolean(table.authLinked) };
		pass(`${table.name} — ${result.rows} row${result.rows === 1 ? '' : 's'}`);
	}
}

// --- 3. storage --------------------------------------------------------------

if (has('--no-storage')) {
	console.log('\nStorage\n');
	info('skipped (--no-storage)');
} else {
	console.log('\nStorage\n');

	// list() is one level at a time, so folders are walked rather than globbed.
	async function walk(bucket, prefix = '') {
		const out = [];
		for (let offset = 0; ; offset += 100) {
			const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 100, offset });
			if (error) {
				warn(`${bucket}/${prefix} — ${error.message}`);
				return out;
			}
			if (!data || data.length === 0) break;

			for (const entry of data) {
				const full = prefix ? `${prefix}/${entry.name}` : entry.name;
				// A row without an id is a folder placeholder, not an object.
				if (entry.id) out.push({ path: full, size: entry.metadata?.size ?? 0 });
				else out.push(...(await walk(bucket, full)));
			}
			if (data.length < 100) break;
		}
		return out;
	}

	for (const bucket of BUCKETS) {
		const objects = await walk(bucket);
		let saved = 0;
		let bytes = 0;

		for (const object of objects) {
			const { data, error } = await db.storage.from(bucket).download(object.path);
			if (error || !data) {
				warn(`${bucket}/${object.path} — ${error?.message ?? 'no body'}`);
				continue;
			}
			const buffer = Buffer.from(await data.arrayBuffer());
			const target = join(dir, 'storage', bucket, object.path);
			mkdirSync(join(target, '..'), { recursive: true });
			writeFileSync(target, buffer);
			saved += 1;
			bytes += buffer.length;
		}

		manifest.storage[bucket] = { objects: saved, bytes };
		pass(
			`${bucket} — ${saved} object${saved === 1 ? '' : 's'}, ${(bytes / 1024 / 1024).toFixed(1)} MB`
		);
	}
}

// --- 4. what this backup can actually put back -------------------------------

const haveSql = Boolean(manifest.sqlDump?.schema && manifest.sqlDump?.data);

manifest.restorable = {
	fullDisasterRecovery: haveSql,
	// Every one of these hangs off auth.users.id, and the Admin API will not let
	// a user be created with a chosen id — so these rows cannot be reattached
	// from the NDJSON alone.
	authLinkedTables: haveSql
		? 'yes — schema.sql carries auth.users'
		: 'no — needs the SQL dump; the NDJSON is an archive, not a restore path',
	standaloneTables:
		'yes — site_content, email_templates, email_suppressions, newsletter_subscribers and job_applications restore from NDJSON',
	storage: has('--no-storage') ? 'not taken' : 'yes — scripts/restore.js re-uploads it'
};

writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log('\nDone\n');
pass(`manifest written to ${join(dir, 'manifest.json')}`);
if (!haveSql) {
	warn('This is a partial backup: no schema, no roles, no auth.users.');
	info('It restores content, email config, storage and the standalone tables.');
	info('For disaster recovery you need the SQL dump — see README → Backups.');
}
console.log('');
