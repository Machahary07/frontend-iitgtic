<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import LinkReveal from '$lib/components/LinkReveal.svelte';
	import ButtonReveal from '$lib/components/ButtonReveal.svelte';
	import Turnstile from '$lib/components/Turnstile.svelte';
	import { signUpFounder } from '$lib/utils/userSession';
	import { verifyTurnstileToken } from '$lib/utils/turnstile';

	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let agreed = $state(false);
	let attempted = $state(false);
	let turnstileToken = $state('');
	let captcha = $state<{ reset: () => void }>();

	type Errors = {
		name?: string;
		email?: string;
		phone?: string;
		password?: string;
		confirmPassword?: string;
		agreed?: string;
		captcha?: string;
	};

	let errors = $state<Errors>({});
	let confirmationEmail = $state('');
	let submitting = $state(false);

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	function validate(): Errors {
		const e: Errors = {};

		if (!name.trim()) {
			e.name = 'Full name is required.';
		} else if (name.trim().length < 2) {
			e.name = 'Please enter your full name.';
		}

		if (!email.trim()) {
			e.email = 'Email is required.';
		} else if (!EMAIL_RE.test(email.trim())) {
			e.email = 'Enter a valid email address.';
		}

		const digits = phone.replace(/\D/g, '');
		if (!phone.trim()) {
			e.phone = 'Phone number is required.';
		} else if (digits.length !== 10) {
			e.phone = 'Phone must be exactly 10 digits.';
		}

		if (!password) {
			e.password = 'Password is required.';
		} else if (password.length < 8) {
			e.password = 'Use at least 8 characters.';
		}

		if (!confirmPassword) {
			e.confirmPassword = 'Please confirm your password.';
		} else if (confirmPassword !== password) {
			e.confirmPassword = 'Passwords do not match.';
		}

		if (!agreed) {
			e.agreed = 'You must accept the Terms and Privacy Policy.';
		}

		if (!turnstileToken) {
			e.captcha = 'Please complete the verification.';
		}

		return e;
	}

	function revalidate() {
		if (attempted) errors = validate();
	}

	function onPhoneInput(ev: Event) {
		const input = ev.currentTarget as HTMLInputElement;
		const digits = input.value.replace(/\D/g, '').slice(0, 10);
		phone = digits;
		input.value = digits;
		revalidate();
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (submitting) return;
		attempted = true;
		const result = validate();
		errors = result;
		if (Object.keys(result).length > 0) return;
		submitting = true;
		try {
			const human = await verifyTurnstileToken(turnstileToken);
			captcha?.reset();
			if (!human) {
				errors = { captcha: 'Verification failed. Please try again.' };
				return;
			}
			const signup = await signUpFounder({
				name: name.trim(),
				email: email.trim(),
				phone: phone.trim(),
				password
			});
			if (!signup.ok) {
				errors = { email: signup.error };
				return;
			}
			if (signup.needsEmailConfirmation) {
				// The project requires email confirmation, so there is no session yet.
				confirmationEmail = signup.session.email ?? email.trim();
				return;
			}
			goto(resolve('/application'));
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Sign up · IITG TIC</title>
</svelte:head>

<section class="apply">
	<div class="apply__inner">
		<div class="apply__grid">
			<!-- LEFT: Instructions -->
			<aside class="info">
				<h2 class="info__title">Instructions</h2>
				<ol class="info__list">
					<li>Sign up to create your IITG TIC account before submitting an application.</li>
					<li>
						Already registered? Log in to apply for Incubation or the TIC Equity and Investment
						Summit.
					</li>
					<li>
						Keep your supporting documents ready, such as Company Registration, GST and Trade
						Licence.
					</li>
				</ol>
			</aside>

			<!-- RIGHT: Form -->
			<div class="form-wrap">
				<header class="apply__header">
					<h1>{confirmationEmail ? 'Confirm your email' : 'Sign up'}</h1>
				</header>

				{#if confirmationEmail}
					<div class="confirm" role="status">
						<p>
							We've sent a confirmation link to <strong>{confirmationEmail}</strong>. Open it to
							activate your account, then log in to start your application.
						</p>
						<LinkReveal href="/login" text="Go to login" class="inline-link" />
					</div>
				{:else}
					<form class="form" onsubmit={handleSubmit} novalidate>
						<label class="field" class:has-error={errors.name}>
							<span class="field__label">
								<span class="field__name">Full name <em class="req">*</em></span>
								{#if errors.name}
									<span class="field__error">{errors.name}</span>
								{/if}
							</span>
							<input
								type="text"
								bind:value={name}
								autocomplete="name"
								oninput={revalidate}
								aria-invalid={!!errors.name}
							/>
						</label>

						<label class="field" class:has-error={errors.email}>
							<span class="field__label">
								<span class="field__name">Email <em class="req">*</em></span>
								{#if errors.email}
									<span class="field__error">{errors.email}</span>
								{/if}
							</span>
							<input
								type="email"
								bind:value={email}
								autocomplete="email"
								oninput={revalidate}
								aria-invalid={!!errors.email}
							/>
						</label>

						<label class="field" class:has-error={errors.phone}>
							<span class="field__label">
								<span class="field__name">Phone <em class="req">*</em></span>
								{#if errors.phone}
									<span class="field__error">{errors.phone}</span>
								{/if}
							</span>
							<input
								type="tel"
								inputmode="numeric"
								maxlength="10"
								value={phone}
								oninput={onPhoneInput}
								autocomplete="tel"
								aria-invalid={!!errors.phone}
							/>
						</label>

						<div class="form__row">
							<label class="field" class:has-error={errors.password}>
								<span class="field__label">
									<span class="field__name">Password <em class="req">*</em></span>
									{#if errors.password}
										<span class="field__error">{errors.password}</span>
									{/if}
								</span>
								<input
									type="password"
									bind:value={password}
									autocomplete="new-password"
									oninput={revalidate}
									aria-invalid={!!errors.password}
								/>
							</label>
							<label class="field" class:has-error={errors.confirmPassword}>
								<span class="field__label">
									<span class="field__name">Confirm <em class="req">*</em></span>
									{#if errors.confirmPassword}
										<span class="field__error">{errors.confirmPassword}</span>
									{/if}
								</span>
								<input
									type="password"
									bind:value={confirmPassword}
									autocomplete="new-password"
									oninput={revalidate}
									aria-invalid={!!errors.confirmPassword}
								/>
							</label>
						</div>

						<div class="agree-wrap" class:has-error={errors.agreed}>
							<div class="agree">
								<label class="agree__toggle">
									<input
										type="checkbox"
										class="agree__input"
										bind:checked={agreed}
										onchange={revalidate}
										aria-label="I agree to the Terms of Use and Privacy Policy"
									/>
									<span class="agree__dot" aria-hidden="true"></span>
								</label>
								<span class="agree__text">
									I agree to the <LinkReveal
										href="/terms"
										text="Terms of Use"
										class="inline-link"
									/> and
									<LinkReveal href="/privacy" text="Privacy Policy" class="inline-link" />
									<em class="req">*</em>
								</span>
							</div>
							{#if errors.agreed}
								<span class="field__error field__error--block">{errors.agreed}</span>
							{/if}
						</div>

						<div class="recaptcha-wrap" class:has-error={errors.captcha}>
							<Turnstile bind:token={turnstileToken} bind:this={captcha} />
							{#if errors.captcha}
								<span class="field__error field__error--block">{errors.captcha}</span>
							{/if}
						</div>

						<ButtonReveal
							type="submit"
							text={submitting ? 'Signing up…' : 'Sign up'}
							class="submit"
							loading={submitting}
						/>

						<p class="form__login">
							Already have an account?
							<LinkReveal href="/login" text="Login" class="inline-link" />
						</p>
					</form>
				{/if}
			</div>
		</div>
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.apply {
		min-height: 100svh;
		background: $color-accent-blue;
		color: $color-white;
		padding: calc(var(--page-shell-top, 104px) + #{$space-10}) 0 $space-8;

		@include breakpoint-down($bp-sm) {
			padding-top: calc(var(--page-shell-top, 100px) + #{$space-8});
		}
	}

	.apply__inner {
		width: 100%;
		max-width: 1360px;
		margin-inline: auto;
		padding-inline: $space-6;

		@include breakpoint-down($bp-sm) {
			padding-inline: $space-4;
		}
	}

	.apply__grid {
		display: grid;
		grid-template-columns: 1fr 1px 1fr;
		column-gap: $space-10;
		row-gap: $space-7;
		align-items: start;

		&::before {
			content: '';
			grid-column: 2;
			grid-row: 1;
			align-self: stretch;
			width: 1px;
			background: rgba($color-white, 0.3);
		}

		@include breakpoint-down($bp-md) {
			grid-template-columns: 1fr;
			column-gap: 0;
			row-gap: $space-5;

			&::before {
				display: none;
			}
		}
	}

	// ---- Info (left) ----
	.info {
		grid-column: 1;
		padding-top: $space-2;
	}

	.info__title {
		margin: 0 0 $space-5;
		font-size: $font-size-3xl;
		font-weight: $font-weight-bold;
		letter-spacing: $letter-spacing-tight;
		text-transform: none;
	}

	.info__list {
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: info;
		display: flex;
		flex-direction: column;
		gap: $space-3;

		> li {
			counter-increment: info;
			position: relative;
			padding-left: $space-5;
			font-size: $font-size-base;
			line-height: $line-height-snug;
			color: rgba($color-white, 0.92);

			&::before {
				content: counter(info) '.';
				position: absolute;
				left: 0;
				top: 0;
				font-weight: $font-weight-semibold;
				color: $color-white;
			}
		}
	}

	// ---- Form (right) ----
	.confirm {
		display: flex;
		flex-direction: column;
		gap: 16px;
		align-items: flex-start;
	}

	.form-wrap {
		grid-column: 3;

		@include breakpoint-down($bp-md) {
			grid-column: 1;
		}
	}

	.apply__header {
		margin-bottom: $space-5;

		h1 {
			margin: 0;
			font-size: $font-size-3xl;
			font-weight: $font-weight-bold;
			letter-spacing: $letter-spacing-tight;
		}
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: $space-4;
	}

	.form__row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: $space-3;

		@include breakpoint-down($bp-xs) {
			grid-template-columns: 1fr;
		}
	}

	$color-error: #ffb4b4;

	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;

		input {
			appearance: none;
			width: 100%;
			padding: 8px 2px;
			font: inherit;
			font-size: $font-size-base;
			color: $color-white;
			background: transparent;
			border: 0;
			border-bottom: 1px solid rgba($color-white, 0.5);
			border-radius: 0;
			transition: border-color $transition-fast;

			&::placeholder {
				color: rgba($color-white, 0.45);
			}

			&:focus {
				outline: none;
				border-bottom-color: $color-white;
			}

			&:-webkit-autofill {
				-webkit-text-fill-color: $color-white;
				-webkit-box-shadow: 0 0 0 1000px $color-accent-blue inset;
				caret-color: $color-white;
			}
		}

		&.has-error input {
			border-bottom-color: $color-error;
		}
	}

	.field__label {
		display: flex;
		align-items: baseline;
		gap: $space-2;
		flex-wrap: wrap;
	}

	.field__name {
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		color: rgba($color-white, 0.85);
	}

	.req {
		font-style: normal;
		color: $color-error;
		margin-left: 2px;
	}

	.field__error {
		font-size: $font-size-xs;
		font-weight: $font-weight-medium;
		color: $color-error;
		letter-spacing: 0;
		text-transform: none;
	}

	.field__error--block {
		display: block;
		margin-top: 6px;
	}

	.agree-wrap {
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-self: flex-start;
	}

	.recaptcha-wrap {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.agree {
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: $space-2;
		font-size: $font-size-sm;
		line-height: 1.3;
		color: $color-white;
		align-self: flex-start;
	}

	.agree__toggle {
		position: relative;
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		cursor: pointer;
	}

	:global(.inline-link) {
		color: $color-white;
		font-weight: $font-weight-semibold;
	}

	.agree__input {
		position: absolute;
		opacity: 0;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		cursor: pointer;
	}

	.agree__dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: transparent;
		border: 1.5px solid $color-white;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;

		&::after {
			content: '';
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: $color-white;
			transform: scale(0);
			transition: transform $transition-fast;
		}
	}

	.agree__input:checked ~ .agree__dot::after {
		transform: scale(1);
	}

	:global(button.button-reveal.submit) {
		padding: 11px 28px;
		border: 1px solid $color-black;
		background: $color-black;
		color: $color-white;
		font-size: $font-size-sm;
		font-weight: $font-weight-bold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		align-self: flex-start;
	}

	.form__login {
		margin: $space-2 0 0;
		display: flex;
		align-items: baseline;
		gap: 6px;
		font-size: $font-size-sm;
		color: $color-white;
	}
</style>
