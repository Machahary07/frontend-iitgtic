<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { supabase } from '$lib/supabaseClient';

	// Where a recovery link ends up, by way of /auth/callback.
	//
	// Supabase treats a recovery token as a real (short-lived) session, so by the
	// time this page loads the person is signed in and updateUser() is allowed.
	// That is also why the page has to check for a session rather than trust the
	// navigation: opened on its own it must not offer a password box it cannot
	// honour.

	const MIN_LENGTH = 8;

	let checking = $state(true);
	let email = $state('');
	let password = $state('');
	let confirm = $state('');
	let error = $state('');
	let saving = $state(false);
	let saved = $state(false);
	let showPassword = $state(false);
	let showConfirm = $state(false);

	onMount(async () => {
		const { data } = await supabase.auth.getSession();
		email = data.session?.user.email ?? '';
		checking = false;
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (saving) return;

		if (password.length < MIN_LENGTH) {
			error = `Use at least ${MIN_LENGTH} characters.`;
			return;
		}
		if (password !== confirm) {
			error = 'Both passwords must match.';
			return;
		}

		saving = true;
		try {
			const { error: updateError } = await supabase.auth.updateUser({ password });
			if (updateError) {
				error = updateError.message;
				return;
			}
			error = '';
			saved = true;

			// The recovery session is not the one they should carry around — sign
			// out so the new password is what gets them back in.
			await supabase.auth.signOut();
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Set a new password · IITG TIC</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#snippet eyeIcon(shown: boolean)}
	{#if shown}
		<svg
			viewBox="0 0 24 24"
			width="18"
			height="18"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path
				d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
			/>
			<line x1="1" y1="1" x2="23" y2="23" />
		</svg>
	{:else}
		<svg
			viewBox="0 0 24 24"
			width="18"
			height="18"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	{/if}
{/snippet}

<section class="page">
	<div class="card">
		{#if checking}
			<p class="eyebrow">Password reset</p>
			<h1>Checking your link…</h1>
		{:else if saved}
			<p class="eyebrow">Password reset</p>
			<h1>Password changed</h1>
			<p class="sub">Sign in with your new password to continue.</p>
			<div class="actions">
				<button class="btn-primary" onclick={() => goto(resolve('/login'))}>Go to sign in</button>
			</div>
		{:else if !email}
			<p class="eyebrow">Password reset</p>
			<h1>Open your reset link first</h1>
			<p class="sub">
				This page needs the link that was emailed to you. If it has expired, ask for a new one from
				the sign-in screen.
			</p>
			<div class="actions">
				<a class="btn-primary" href={resolve('/login')}>Back to sign in</a>
			</div>
		{:else}
			<div class="head">
				<p class="eyebrow">Password reset</p>
				<h1>Set a new password</h1>
				<p class="sub">Choosing a new password for <strong>{email}</strong>.</p>
			</div>

			<form onsubmit={handleSubmit} novalidate>
				<label class="field">
					<span>New password</span>
					<div class="field__control">
						<input
							type={showPassword ? 'text' : 'password'}
							value={password}
							oninput={(e) => (password = e.currentTarget.value)}
							autocomplete="new-password"
							minlength={MIN_LENGTH}
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
					<span>Confirm new password</span>
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

				{#if error}
					<p class="error" role="alert">{error}</p>
				{/if}

				<button type="submit" class="btn-primary" disabled={saving}>
					{saving ? 'Saving…' : 'Save password'}
				</button>

				<p class="hint">At least {MIN_LENGTH} characters.</p>
			</form>
		{/if}
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

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
		max-width: 420px;
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

	.actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 22px;
	}

	.hint {
		margin: 4px 0 0;
		font-size: 12px;
		color: #777;
		text-align: center;
	}
</style>
