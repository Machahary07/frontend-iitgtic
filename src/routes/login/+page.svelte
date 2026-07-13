<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import LinkReveal from '$lib/components/LinkReveal.svelte';
	import ButtonReveal from '$lib/components/ButtonReveal.svelte';
	import Turnstile from '$lib/components/Turnstile.svelte';
	import { saveUserSession } from '$lib/utils/userSession';
	import { verifyTurnstileToken } from '$lib/utils/turnstile';

	let email = $state('');
	let password = $state('');
	let remember = $state(false);
	let error = $state('');
	let turnstileToken = $state('');
	let captcha = $state<{ reset: () => void }>();

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!email || !password) {
			error = 'Please enter both your email and password.';
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
		error = '';
		saveUserSession({ email: email.trim() });
		goto(resolve('/application'));
	}
</script>

<svelte:head>
	<title>Login · IITG TIC</title>
</svelte:head>

<section class="login">
	<div class="login__inner">
		<header class="login__header">
				<h1>Login</h1>
				<p class="login__sub">Access your IITG TIC account to continue your application.</p>
			</header>

			<form class="form" onsubmit={handleSubmit} novalidate>
				<label class="field">
					<span>Email</span>
					<input type="email" bind:value={email} autocomplete="email" required />
				</label>

				<label class="field">
					<span>Password</span>
					<input
						type="password"
						bind:value={password}
						autocomplete="current-password"
						required
					/>
				</label>

				<div class="form__meta">
					<label class="agree">
						<input type="checkbox" class="agree__input" bind:checked={remember} />
						<span class="agree__dot" aria-hidden="true"></span>
						<span class="agree__text">Remember me</span>
					</label>
					<LinkReveal href="/login" text="Forgot password?" class="form__forgot inline-link" />
				</div>

				<Turnstile bind:token={turnstileToken} bind:this={captcha} />

				{#if error}
					<p class="form__error" role="alert">{error}</p>
				{/if}

				<ButtonReveal type="submit" text="Login" class="submit" />

				<p class="form__signup">
					Don't have an account?
					<LinkReveal href="/apply" text="Sign up" class="inline-link" />
				</p>
			</form>
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.login {
		min-height: 100svh;
		background: $color-accent-blue;
		color: $color-white;
		padding: calc(var(--page-shell-top, 104px) + #{$space-10}) 0 $space-8;
		display: flex;
		justify-content: center;

		@include breakpoint-down($bp-sm) {
			padding-top: calc(var(--page-shell-top, 100px) + #{$space-8});
		}
	}

	.login__inner {
		width: 100%;
		max-width: 460px;
		padding-inline: $space-6;

		@include breakpoint-down($bp-sm) {
			padding-inline: $space-4;
		}
	}

	.login__header {
		margin-bottom: $space-6;

		h1 {
			margin: 0 0 $space-2;
			font-size: $font-size-3xl;
			font-weight: $font-weight-bold;
			letter-spacing: $letter-spacing-tight;
		}
	}

	.login__sub {
		margin: 0;
		font-size: $font-size-base;
		color: rgba($color-white, 0.85);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: $space-4;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;

		> span {
			font-size: $font-size-xs;
			font-weight: $font-weight-semibold;
			letter-spacing: $letter-spacing-wide;
			text-transform: uppercase;
			color: rgba($color-white, 0.85);
		}

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
	}

	.form__meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: $space-3;
		margin-top: $space-1;
	}

	:global(.form__forgot) {
		font-size: $font-size-sm;
		color: $color-white;
		font-weight: $font-weight-semibold;
	}

	:global(.inline-link) {
		color: $color-white;
		font-weight: $font-weight-semibold;
	}

	.form__error {
		margin: 0;
		padding: 8px 12px;
		font-size: $font-size-sm;
		color: $color-white;
		background: rgba($color-black, 0.25);
		border-left: 2px solid $color-white;
	}

	.agree {
		display: inline-flex;
		align-items: center;
		gap: $space-2;
		font-size: $font-size-sm;
		line-height: 1.3;
		color: $color-white;
		cursor: pointer;
		position: relative;
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

	.form__signup {
		margin: $space-2 0 0;
		display: flex;
		align-items: baseline;
		gap: 6px;
		font-size: $font-size-sm;
		color: $color-white;
	}

</style>
