import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

// Mock the provider and cookies, but execute the actual validation module.
// Run with: node --test tests/session-validation.test.mjs
const source = readFileSync(new URL('../src/lib/server/sessionValidation.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function fixture() {
	const state = {
		user: { id: 'dummy-user', email: 'dummy@example.invalid' },
		profile: { role: 'admin', full_name: 'Current name', email: 'dummy@example.invalid' },
		authError: null,
		profileError: null,
		session: { userId: 'dummy-user', name: 'Old name', email: 'old@example.invalid' },
		cleared: []
	};
	const query = {
		select() { return this; },
		eq() { return this; },
		async maybeSingle() { return { data: state.profile, error: state.profileError }; }
	};
	const modules = {
		'@sveltejs/kit': { error(status, message) { throw Object.assign(new Error(message), { status }); } },
		'$lib/server/supabaseAdmin': { supabaseAdmin: {
			auth: { admin: { async getUserById() { return { data: { user: state.user }, error: state.authError }; } } },
			from() { return query; }
		} },
		'$lib/server/ticAdminSession': {
			readTicAdminSession: () => state.session,
			clearTicAdminSession: () => state.cleared.push('admin')
		},
		'$lib/server/founderSession': {
			readFounderSession: () => state.session,
			clearFounderSession: () => state.cleared.push('founder')
		}
	};
	const exports = {};
	runInNewContext(compiled, { exports, require: (name) => {
		if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
		return modules[name];
	} }, { timeout: 1000 });
	return { state, api: exports };
}

test('active admin is refreshed, then the same cookie is denied after demotion', async () => {
	const { state, api } = fixture();
	assert.equal((await api.validatedAdminSession({})).name, 'Current name');
	state.profile.role = 'founder';
	assert.equal(await api.validatedAdminSession({}), null);
	assert.deepEqual(state.cleared, ['admin']);
});

for (const kind of ['Admin', 'Founder']) {
	for (const scenario of ['banned', 'deleted', 'soft-deleted', 'missing-profile']) {
		test(`${kind} cookie is denied for ${scenario} account`, async () => {
			const { state, api } = fixture();
			if (scenario === 'banned') state.user.banned_until = new Date(Date.now() + 60000).toISOString();
			if (scenario === 'deleted') { state.user = null; state.authError = { status: 404 }; }
			if (scenario === 'soft-deleted') state.user.deleted_at = new Date().toISOString();
			if (scenario === 'missing-profile') state.profile = null;
			assert.equal(await api[`validated${kind}Session`]({}), null);
			assert.deepEqual(state.cleared, [kind.toLowerCase()]);
		});
	}
	for (const failure of ['authError', 'profileError']) {
		test(`${kind} fails closed when ${failure} lookup fails`, async () => {
			const { state, api } = fixture();
			state[failure] = { status: 500 };
			await assert.rejects(api[`validated${kind}Session`]({}), { status: 503 });
			assert.deepEqual(state.cleared, []);
		});
	}
}

test('founder is allowed after ban expiry; missing cookie is denied', async () => {
	const { state, api } = fixture();
	state.profile.role = 'founder';
	state.user.banned_until = new Date(Date.now() - 60000).toISOString();
	assert.equal((await api.validatedFounderSession({})).userId, 'dummy-user');
	state.session = null;
	assert.equal(await api.validatedFounderSession({}), null);
	assert.equal(await api.validatedAdminSession({}), null);
});
