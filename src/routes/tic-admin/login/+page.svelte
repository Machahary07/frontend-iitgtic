<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';
	import { bootstrapFirstAdmin } from '$lib/utils/ticAdminAuth';
	import type { PageData } from './$types';
	import Turnstile from '$lib/components/Turnstile.svelte';
	import { verifyTurnstileToken } from '$lib/utils/turnstile';

	// The layout load already knows whether an admin exists, so this screen paints
	// in its right state immediately rather than after a round trip.
	let { data }: { data: PageData } = $props();
	let bootstrapped = $state(false);
	const needsBootstrap = $derived(data.needsBootstrap && !bootstrapped);
	// A database that cannot be read is not a first run. Showing the setup form in
	// that case sends people hunting for a password that was never the problem.
	const dbError = $derived(data.dbError);
	const configuredHost = PUBLIC_SUPABASE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

	let error = $state('');
	let submitting = $state(false);
	let turnstileToken = $state('');
	let captcha = $state<{ reset: () => void }>();

	// First-run only: the shared setup password from the environment creates the
	// very first admin account, then stops working.
	let setupPassword = $state('');
	let setupName = $state('');
	let setupEmail = $state('');
	let setupPw = $state('');
	let setupConfirm = $state('');
	let setupDone = $state(false);

	async function passedCaptcha() {
		if (!turnstileToken) {
			error = 'Please complete the verification below.';
			return false;
		}
		const human = await verifyTurnstileToken(turnstileToken);
		captcha?.reset();
		turnstileToken = '';
		if (!human) {
			error = 'Verification failed. Please try again.';
			return false;
		}
		return true;
	}

	async function handleBootstrap(e: Event) {
		e.preventDefault();
		if (submitting) return;
		if (setupPw !== setupConfirm) {
			error = 'The two passwords do not match.';
			return;
		}
		submitting = true;
		try {
			if (!(await passedCaptcha())) return;
			const result = await bootstrapFirstAdmin({
				setupPassword,
				email: setupEmail,
				password: setupPw,
				fullName: setupName
			});
			if (!result.ok) {
				error = result.error;
				return;
			}
			error = '';
			setupDone = true;
			bootstrapped = true;
			await invalidateAll();
			setupPassword = '';
			setupPw = '';
			setupConfirm = '';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>TIC Admin · Sign in</title>
</svelte:head>

<section class="login">
	<div class="card">
		{#if dbError}
			<div class="card__head">
				<p class="eyebrow">IITG TIC · Cannot start</p>
				<h1>Database unreachable</h1>
				<p class="sub">
					The console could not read the admin list, so it cannot tell whether an account exists.
					This is an environment problem, not a sign-in problem.
				</p>
			</div>

			<p class="error" role="alert">{dbError}</p>

			<div class="checklist">
				<p class="checklist__head">In <code>.env.local</code>, check that:</p>
				<ul>
					<li>
						<code>PUBLIC_SUPABASE_URL</code> points at the shared project. It is currently
						<code>{configuredHost}</code> — compare that against the project ref the rest of the team
						is using.
					</li>
					<li>
						<code>SUPABASE_SERVICE_ROLE_KEY</code> is the <em>secret</em> key (<code
							>sb_secret_…</code
						>), not the publishable one.
					</li>
					<li>The dev server was restarted after editing the file.</li>
				</ul>
				<p class="checklist__foot">Run <code>pnpm run doctor</code> to test each of these.</p>
			</div>
		{:else if needsBootstrap}
			<div class="card__head">
				<p class="eyebrow">IITG TIC · First run</p>
				<h1>Create the first admin</h1>
				<p class="sub">
					No admin account exists yet. Enter the setup password from the server environment to
					create one — after this, admins sign in with their own email and password and the setup
					password stops working.
				</p>
			</div>

			<form onsubmit={handleBootstrap} novalidate>
				<label class="field">
					<span>Setup password</span>
					<input type="password" bind:value={setupPassword} required />
				</label>
				<label class="field">
					<span>Your name</span>
					<input type="text" bind:value={setupName} autocomplete="name" />
				</label>
				<label class="field">
					<span>Your email</span>
					<input type="email" bind:value={setupEmail} autocomplete="email" required />
				</label>
				<label class="field">
					<span>Choose a password</span>
					<input type="password" bind:value={setupPw} autocomplete="new-password" required />
				</label>
				<label class="field">
					<span>Confirm password</span>
					<input type="password" bind:value={setupConfirm} autocomplete="new-password" required />
				</label>

				<Turnstile bind:token={turnstileToken} bind:this={captcha} />

				{#if error}
					<p class="error" role="alert">{error}</p>
				{/if}

				<button type="submit" disabled={submitting}>
					{submitting ? 'Creating…' : 'Create admin account'}
				</button>
			</form>
		{:else}
			<div class="card__head">
				<p class="eyebrow">IITG TIC</p>
				<h1>Sign in at one place</h1>
				<p class="sub">
					The console no longer has a sign-in page of its own. Everyone — the TIC team, founders and
					the people they add — signs in on the same form, and lands wherever their account belongs.
				</p>
			</div>

			{#if setupDone}
				<p class="notice" role="status">
					Admin account created. Sign in with the password you just chose.
				</p>
			{/if}

			<a class="go" href={resolve('/login')}>Go to sign in</a>

			<p class="hint">For TIC team members only. Ask an existing admin to create your account.</p>
		{/if}
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.login {
		min-height: 100svh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: $admin-sunken;
		padding: 24px;
		font-family: $font-family-base;
	}

	.card {
		width: 100%;
		max-width: 380px;
		padding: 32px 28px 28px;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
	}

	.card__head {
		margin-bottom: 24px;
		text-align: left;
	}

	.eyebrow {
		margin: 0 0 6px;
		font-size: 11px;
		font-weight: $font-weight-bold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: $admin-ink-3;
	}

	h1 {
		margin: 0 0 8px;
		font-size: 22px;
		font-weight: $font-weight-semibold;
		color: #111;
		letter-spacing: -0.01em;
	}

	.sub {
		margin: 0;
		font-size: 13px;
		color: #555;
		line-height: 1.5;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;

		> span {
			font-size: 11px;
			font-weight: $font-weight-semibold;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: #444;
		}

		input {
			padding: 10px 12px;
			font: inherit;
			font-size: 14px;
			color: #111;
			background: #fff;
			border: 1px solid $admin-line;
			border-radius: $admin-radius-sm;

			&:focus {
				outline: none;
				border-color: #111;
				box-shadow: 0 0 0 3px rgba(17, 17, 17, 0.08);
			}
		}
	}

	.error {
		margin: 0;
		padding: 8px 12px;
		font-size: 13px;
		color: #a01515;
		background: #fdecec;
		border: 1px solid #f5c2c2;
		border-radius: $admin-radius-sm;
	}

	.checklist {
		margin-top: 16px;
		padding: 12px 14px;
		font-size: 13px;
		line-height: 1.55;
		color: #3f4652;
		background: $admin-sunken;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-sm;

		p {
			margin: 0;
		}

		ul {
			margin: 8px 0;
			padding-left: 18px;
		}

		li + li {
			margin-top: 6px;
		}

		code {
			padding: 1px 4px;
			font-size: 12px;
			background: #eceef2;
			border-radius: 4px;
			word-break: break-all;
		}
	}

	.checklist__head {
		font-weight: 600;
		color: #1c2027;
	}

	.checklist__foot {
		padding-top: 8px;
		border-top: 1px solid $admin-line-soft;
	}

	button {
		padding: 11px 16px;
		font: inherit;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #fff;
		background: #111;
		border: 1px solid #111;
		border-radius: $admin-radius-sm;
		cursor: pointer;
	}

	.notice {
		margin: 0 0 16px;
		padding: 10px 12px;
		font-size: 13px;
		color: #0e6b2c;
		background: #e8f7ee;
		border: 1px solid #bfe6cd;
		border-radius: $admin-radius-sm;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.hint {
		margin: 18px 0 0;
		font-size: 12px;
		color: $admin-ink-3;
		text-align: center;
	}

	// The only control left on this screen once an admin exists: the way to the
	// one sign-in page.
	.go {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 11px 18px;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #fff;
		background: $admin-ink;
		border-radius: $admin-radius-md;
		text-decoration: none;
		@include admin-focus-ring;
	}
</style>
