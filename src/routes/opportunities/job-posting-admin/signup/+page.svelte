<script lang="ts">
	import { sendCompanySignupEmail, signupCompany } from '$lib/utils/companyAuth';
	import Turnstile from '$lib/components/Turnstile.svelte';
	import { verifyTurnstileToken } from '$lib/utils/turnstile';

	let companyName = $state('');
	let contactName = $state('');
	let contactEmail = $state('');
	let phone = $state('');
	let email = $state('');
	let website = $state('');
	let password = $state('');
	let confirm = $state('');
	let error = $state('');
	let submittedEmail = $state('');
	let needsEmailConfirmation = $state(false);
	let turnstileToken = $state('');
	let captcha = $state<{ reset: () => void }>();
	let showPassword = $state(false);
	let showConfirm = $state(false);

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
		const result = await signupCompany({
			email,
			password,
			companyName,
			contactName,
			contactEmail,
			phone,
			website
		});
		if (!result.ok) {
			error = result.error;
			return;
		}
		error = '';
		needsEmailConfirmation = result.needsEmailConfirmation;
		submittedEmail = result.email;
		await sendCompanySignupEmail(result.email);
	}
</script>

<svelte:head>
	<title>Create company account · IITG TIC</title>
</svelte:head>

{#snippet eyeIcon(shown: boolean)}
	{#if shown}
		<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
			<line x1="1" y1="1" x2="23" y2="23" />
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	{/if}
{/snippet}

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
					<input type="text" bind:value={contactName} autocomplete="name" required />
				</label>

				<label class="field">
					<span>Contact person email</span>
					<input type="email" bind:value={contactEmail} autocomplete="email" required />
				</label>

				<label class="field">
					<span>Phone number</span>
					<input type="tel" bind:value={phone} autocomplete="tel" required />
				</label>

				<label class="field">
					<span>Company website <span class="optional">(optional)</span></span>
					<input type="url" bind:value={website} placeholder="https://" autocomplete="url" />
				</label>

				<label class="field">
					<span>Work email <span class="optional">(for sign-in)</span></span>
					<input type="email" bind:value={email} autocomplete="email" required />
				</label>

				<div class="row">
					<label class="field">
						<span>Password</span>
						<div class="field__control">
							<input
								type={showPassword ? 'text' : 'password'}
								value={password}
								oninput={(e) => (password = e.currentTarget.value)}
								autocomplete="new-password"
								required
							/>
							<button
								type="button"
								class="reveal-toggle"
								onclick={() => (showPassword = !showPassword)}
								aria-label={showPassword ? 'Hide password' : 'Show password'}
								aria-pressed={showPassword}
							>
								{@render eyeIcon(showPassword)}
							</button>
						</div>
					</label>

					<label class="field">
						<span>Confirm</span>
						<div class="field__control">
							<input
								type={showConfirm ? 'text' : 'password'}
								value={confirm}
								oninput={(e) => (confirm = e.currentTarget.value)}
								autocomplete="new-password"
								required
							/>
							<button
								type="button"
								class="reveal-toggle"
								onclick={() => (showConfirm = !showConfirm)}
								aria-label={showConfirm ? 'Hide password' : 'Show password'}
								aria-pressed={showConfirm}
							>
								{@render eyeIcon(showConfirm)}
							</button>
						</div>
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
		background: $admin-sunken;
		padding: 32px 20px;
		font-family: $font-family-base;
	}

	.card {
		width: 100%;
		max-width: 480px;
		padding: 32px 28px 28px;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
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

	.optional {
		font-weight: $font-weight-regular;
		text-transform: none;
		letter-spacing: 0;
		color: $admin-ink-3;
	}

	.field__control {
		position: relative;
		display: flex;
		align-items: center;

		input {
			flex: 1;
			padding-right: 40px;
		}
	}

	.reveal-toggle {
		position: absolute;
		right: 4px;
		top: 50%;
		transform: translateY(-50%);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: none;
		border: 0;
		color: $admin-ink-3;
		cursor: pointer;

		svg {
			display: block;
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
		color: $admin-ink-3;
		text-align: center;

		a {
			color: #2050d4;
			text-decoration: none;
			font-weight: $font-weight-semibold;
		}
	}
</style>
