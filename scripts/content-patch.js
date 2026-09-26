// Applies a content patch — a list of targeted edits — to content.json and to
// the sections already stored in site_content.
//
//   node scripts/content-patch.js scripts/patches/<file>.js                  dry run: print what would change
//   node scripts/content-patch.js scripts/patches/<file>.js --apply          write content.json
//   node scripts/content-patch.js scripts/patches/<file>.js --apply --live   …and the live database
//
// seed-content.js --only replaces a whole section, which takes every console
// edit with it — an uploaded logo, a reworded hero. A patch touches only the
// values it names, and only when they still hold the text it expects, so a copy
// change made in the console since is reported as a conflict rather than lost.
//
// A patch module default-exports an array of operations:
//
//   { key, path, from, to }   replace a value, only if it currently equals `from`
//   { key, path, add }        set a value, only if nothing is there yet
//
// `key` is the site_content key ('pages.partners'). `path` walks into the
// section: dotted fields, numeric indexes, and `[field=value]` to pick a list
// item by one of its fields — `partners[name=MeitY].category`. An empty path
// addresses the section itself, so `{ key: 'home', path: '', add: {...} }`
// creates a new section.
//
// A section with no stored row reads straight from content.json, so the
// database side skips it: it picks up the change from the JSON on deploy.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = new URL('../', import.meta.url);
const jsonPath = new URL('src/lib/data/content.json', root);

const patchArg = process.argv[2];
const apply = process.argv.includes('--apply');
const live = apply && process.argv.includes('--live');
if (!patchArg || patchArg.startsWith('--')) {
	console.error('Usage: node scripts/content-patch.js <patch.js> [--apply [--live]]');
	process.exit(1);
}

const { default: ops } = await import(pathToFileURL(resolve(patchArg)).href);

const env = Object.fromEntries(
	readFileSync(new URL('.env.local', root), 'utf8')
		.split('\n')
		.filter((line) => line.includes('=') && !line.trim().startsWith('#'))
		.map((line) => [
			line.slice(0, line.indexOf('=')).trim(),
			line.slice(line.indexOf('=') + 1).trim()
		])
);

const admin = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false }
});

// `partners[name=MeitY].category` → ['partners', { name: 'MeitY' }, 'category']
function tokens(path) {
	const out = [];
	for (const m of path.matchAll(/\[([^=\]]+)=([^\]]+)\]|([^.[\]]+)/g)) {
		if (m[3] !== undefined) out.push(/^\d+$/.test(m[3]) ? Number(m[3]) : m[3]);
		else out.push({ [m[1]]: m[2] });
	}
	return out;
}

function step(node, token) {
	if (node === null || typeof node !== 'object') return undefined;
	if (typeof token === 'object') {
		const [field, value] = Object.entries(token)[0];
		return Array.isArray(node) ? node.find((item) => item?.[field] === value) : undefined;
	}
	return node[token];
}

// Returns [parent, lastToken] for a path, or null when an intermediate is missing.
function locate(section, path) {
	const parts = tokens(path);
	let node = section;
	for (const part of parts.slice(0, -1)) {
		node = step(node, part);
		if (node === undefined) return null;
	}
	return [node, parts[parts.length - 1]];
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const short = (v) => {
	const s = JSON.stringify(v) ?? 'undefined';
	return s.length > 110 ? `${s.slice(0, 107)}…` : s;
};

// Applies one op to a section value in place. Returns 'changed' | 'already' | a conflict reason.
function run(section, op) {
	if (op.path === '') return 'add-section';
	const found = locate(section, op.path);
	if (!found) return 'conflict: path not found';
	const [parent, last] = found;
	if (typeof last === 'object') return 'conflict: path must end in a field';
	const current = parent[last];

	if ('add' in op) {
		if (current !== undefined) return same(current, op.add) ? 'already' : 'already (kept existing)';
		parent[last] = structuredClone(op.add);
		return 'changed';
	}
	if (same(current, op.to)) return 'already';
	if (!same(current, op.from)) return `conflict: holds ${short(current)}`;
	parent[last] = structuredClone(op.to);
	return 'changed';
}

function readKey(doc, key) {
	return key.split('.').reduce((n, p) => (n && typeof n === 'object' ? n[p] : undefined), doc);
}

function writeKey(doc, key, value) {
	const parts = key.split('.');
	let node = doc;
	for (const part of parts.slice(0, -1)) node = node[part] ??= {};
	node[parts[parts.length - 1]] = value;
}

// ── content.json ────────────────────────────────────────────────────────────
const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
const report = { json: [], db: [] };

for (const op of ops) {
	let section = readKey(json, op.key);
	let result;
	if (op.path === '') {
		if (section === undefined) {
			writeKey(json, op.key, structuredClone(op.add));
			result = 'changed';
		} else result = 'already (kept existing)';
	} else if (section === undefined) result = 'conflict: section not in content.json';
	else result = run(section, op);
	report.json.push([op, result]);
}

// ── site_content ────────────────────────────────────────────────────────────
const keys = [...new Set(ops.map((op) => op.key))];
const { data: rows, error } = await admin
	.from('site_content')
	.select('key, value, label')
	.in('key', keys);
if (error) {
	console.error(`Could not read site_content: ${error.message}`);
	process.exit(1);
}
const stored = new Map(rows.map((row) => [row.key, row]));
const dirty = new Set();

for (const op of ops) {
	const row = stored.get(op.key);
	if (!row) {
		report.db.push([op, 'skipped: not stored, reads from content.json']);
		continue;
	}
	const result = op.path === '' ? 'already (kept existing)' : run(row.value, op);
	if (result === 'changed') dirty.add(op.key);
	report.db.push([op, result]);
}

// ── report ──────────────────────────────────────────────────────────────────
for (const [target, entries] of Object.entries(report)) {
	console.log(`\n${target === 'json' ? 'content.json' : 'site_content (live)'}`);
	for (const [op, result] of entries) {
		const mark = result === 'changed' ? '✓' : result.startsWith('conflict') ? '✗' : '·';
		console.log(`  ${mark} ${op.key}${op.path ? ` › ${op.path}` : ''} — ${result}`);
	}
}

const conflicts = [...report.json, ...report.db].filter(([, r]) => r.startsWith('conflict'));
if (conflicts.length)
	console.log(`\n${conflicts.length} conflict(s) — those values were left alone.`);

if (!apply) {
	console.log('\nDry run. Re-run with --apply to write.');
	process.exit(0);
}

writeFileSync(jsonPath, `${JSON.stringify(json, null, '\t')}\n`);
console.log('\nwrote    content.json (run prettier on it)');

if (!live) {
	console.log('Database left alone. Add --live to update the stored sections too.');
	process.exit(0);
}

for (const key of dirty) {
	const row = stored.get(key);
	const { error: writeError } = await admin
		.from('site_content')
		.update({ value: row.value, updated_at: new Date().toISOString() })
		.eq('key', key);
	if (writeError) console.error(`failed   ${key}: ${writeError.message}`);
	else console.log(`updated  ${key}`);
}
console.log('\nThe live site picks database changes up within a minute (content cache TTL).');
