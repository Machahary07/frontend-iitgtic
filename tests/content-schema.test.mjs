import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

// The console's list templates and dropdowns are keyed by path strings, which
// nothing type-checks — a renamed field silently turns a dropdown back into a
// text box. This runs the real content module against the real content.json.
// Run with: node --test tests/content-schema.test.mjs
const content = JSON.parse(
	readFileSync(new URL('../src/lib/data/content.json', import.meta.url), 'utf8')
);
const source = readFileSync(new URL('../src/lib/content.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

const exports = {};
runInNewContext(compiled, {
	exports,
	require: (id) => {
		if (id === '$lib/data/content.json') return content;
		throw new Error(`unexpected import ${id}`);
	}
});
const { CONTENT_SECTIONS, LIST_TEMPLATES, FIELD_OPTIONS } = exports;

// Walks an editor path ('pages.x.list[].field') through the document. A `[]`
// step fans out over every item; an empty list ends the walk as satisfied,
// since there is nothing yet to disagree with the path.
function resolves(doc, path) {
	const walk = (node, parts) => {
		if (parts.length === 0) return node !== undefined;
		const [head, ...rest] = parts;
		const field = head.replace(/\[\]$/, '');
		const next = node?.[field];
		if (!head.endsWith('[]')) return walk(next, rest);
		if (!Array.isArray(next)) return false;
		return next.length === 0 || next.every((item) => walk(item, rest));
	};
	return walk(doc, path.split('.'));
}

test('every content section the console lists exists in content.json', () => {
	for (const { key } of CONTENT_SECTIONS) assert.ok(resolves(content, key), key);
});

test('list templates and dropdowns point at real paths', () => {
	for (const key of Object.keys(LIST_TEMPLATES)) {
		assert.ok(resolves(content, key), `LIST_TEMPLATES › ${key}`);
		// A template is for an empty list, so it must describe a list.
		const list = key.replace(/\[\]/g, '.0').split('.');
		assert.ok(
			key.includes('[]') || Array.isArray(list.reduce((n, p) => n?.[p], content)),
			`LIST_TEMPLATES › ${key} is not a list`
		);
	}
	for (const key of Object.keys(FIELD_OPTIONS)) {
		const listPath = key.slice(0, key.lastIndexOf('.'));
		assert.ok(resolves(content, listPath.replace(/\[\]$/, '')), `FIELD_OPTIONS › ${key}`);
	}
});

test('partners are grouped only into categories that exist', () => {
	const partners = content.pages.partners;
	const options = FIELD_OPTIONS['pages.partners.partners[].category'](partners);
	assert.equal(options.length, 4);
	const ids = new Set(options.map((o) => o.value));
	for (const p of partners.partners) {
		assert.ok(ids.has(p.category), `${p.name} → ${p.category}`);
		assert.ok(p.enables, `${p.name} says what it enables`);
	}
});

test('startup sectors come from the section, stages are fixed', () => {
	const section = content.pages.incubatedStartups;
	const sectors = FIELD_OPTIONS['pages.incubatedStartups.categories[].startups[].sector'](section);
	assert.equal(sectors.length, section.sectors.length);
	assert.ok(sectors.length > 0);
	const stages = FIELD_OPTIONS['pages.incubatedStartups.categories[].startups[].stage'](section);
	assert.ok(stages.some((s) => s.value === 'MVP'));

	const blank = LIST_TEMPLATES['pages.incubatedStartups.categories[].startups']();
	assert.equal(blank.featured, false);
	assert.deepEqual(Object.keys(blank.founderStory), [
		'whatTheyBuilt',
		'whatTicContributed',
		'whereTheyAreNow'
	]);
});

test('homepage sections answer the brief and link to real pages', () => {
	const home = content.home;
	assert.equal(home.pathways.items.length, 6);
	assert.deepEqual(
		home.why.items.map((i) => i.id),
		['iitg', 'deeptech', 'northeast']
	);
	assert.equal(home.journey.steps.length, 6);
	assert.ok(home.proof.items.some((i) => i.verified));

	const hrefs = [
		...home.journey.steps.map((s) => s.href),
		...home.pathways.items.map((p) => p.href),
		home.stories.href
	];
	for (const href of hrefs) {
		const [, first, slug] = href.split('/');
		const route = new URL(`../src/routes/${first}/`, import.meta.url);
		assert.ok(existsSync(route), `${href} has no route`);
		if (first === 'incubation' && slug) {
			assert.ok(
				content.pages.incubation.links.some((l) => l.slug === slug),
				`${href} is not an incubation page`
			);
		}
	}
});
