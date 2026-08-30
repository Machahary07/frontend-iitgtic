<script lang="ts">
	import { signupCompany } from '$lib/utils/companyAuth';
	import Turnstile from '$lib/components/Turnstile.svelte';
	import { verifyTurnstileToken } from '$lib/utils/turnstile';

	let companyName = $state('');
	let contactName = $state('');
	let email = $state('');
	let website = $state('');
	let password = $state('');
	let confirm = $state('');
	let error = $state('');
	let submittedEmail = $state('');
	let needsEmailConfirmation = $state(false);
	let turnstileToken = $state('');
	let captcha = $state<{ reset: () => void }>();

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (password !== confirm) {
			error = 'Passwords do not match.';
			return;
		}
		if (!turnstileToken) {
			error = 'Please complete the verification below.';
			return;
		}
		const human = await verifyTurnstileToken(turnstileToken);
		captcha?.reset();
		if (!human) {
			error = 'Verification failed. Please try again.';
			return;
		}
		const result = await signupCompany({ email, password, companyName, website, contactName });
		if (!result.ok) {
			error = result.error;
			return;
		}
		error = '';
		needsEmailConfirmation = result.needsEmailConfirmation;
		submittedEmail = result.email;
	}
</script>

<svelte:head>
	<title>Create company account · IITG TIC</title>
</svelte:head>

<section class="page">
	<div class="card">
		{#if submittedEmail}
			<div class="head">
				<p class="eyebrow">Verification required</p>
				<h1>Account created</h1>
				<p class="sub">
					Thanks for signing up <strong>{submittedEmail}</strong>. The IITG-TIC team will manually
					verify that you are affiliated with TIC before posting unlocks. You'll be notified once
					approved.
				</p>
				{#if needsEmailConfirmation}
					<p class="sub">Check your inbox first — confirm your email address before signing in.</p>
				{/if}
			</div>

			<div class="actions">
				<a class="btn-primary" href="/opportunities/job-posting-admin">Go to dashboard</a>
				<a class="btn" href="/opportunities">Back to Opportunities</a>
			</div>
		{:else}
			<div class="head">
				<p class="eyebrow">Companies</p>
				<h1>Create account</h1>
				<p class="sub">
					Once your account is reviewed by the IITG-TIC team, you can post and manage open roles
					from your dashboard.
				</p>
			</div>

			<form onsubmit={handleSubmit} novalidate>
				<label class="field">
					<span>Company name</span>
					<input type="text" bind:value={companyName} autocomplete="organization" required />
				</label>

				<label class="field">
					<span>Contact person</span>
					<input type="text" bind:value={contactName} autocomplete="name" />
				</label>

				<label class="field">
					<span>Company website</span>
					<input type="url" bind:value={website} placeholder="https://" autocomplete="url" />
				</label>

				<label class="field">
					<span>Work email</span>
					<input type="email" bind:value={email} autocomplete="email" required />
				</label>

				<div class="row">
					<label class="field">
						<span>Password</span>
						<input type="password" bind:value={password} autocomplete="new-password" required />
					</label>

					<label class="field">
						<span>Confirm</span>
						<input type="password" bind:value={confirm} autocomplete="new-password" required />
					</label>
				</div>

				<Turnstile bind:token={turnstileToken} bind:this={captcha} />

				{#if error}
					<p class="error" role="alert">{error}</p>
				{/if}

				<button type="submit" class="btn-primary">Create account</button>

				<p class="hint">
					Already have an account? <a href="/opportunities/job-posting-admin">Sign in</a>
				</p>
			</form>
		{/if}
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;
	@use '$styles/mixins' as *;

	.page {
		min-height: 100svh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f6f7f9;
		padding: 32px 20px;
		font-family: $font-family-base;
	}

	.card {
		width: 100%;
		max-width: 480px;
		padding: 32px 28px 28px;
		background: #fff;
		border: 1px solid #e6e8ec;
		border-radius: 10px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
	}

	.head {
		margin-bottom: 22px;
	}

	.eyebrow {
		@include admin-eyebrow;
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
		line-height: 1.55;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;

		@include breakpoint-down($bp-xs) {
			grid-template-columns: 1fr;
		}
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;

		> span {
			@include admin-field-label;
		}

		input {
			@include admin-input;
		}
	}

	.error {
		@include admin-msg-err;
	}

	.btn-primary {
		@include admin-btn-primary;
		justify-content: center;
	}

	.btn {
		@include admin-btn-base;
		justify-content: center;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.hint {
		margin: 8px 0 0;
		font-size: 12px;
		color: #777;
		text-align: center;

		a {
			color: #2050d4;
			text-decoration: none;
			font-weight: $font-weight-semibold;

			&:hover {
				text-decoration: underline;
			}
		}
	}
</style>
