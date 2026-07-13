<script lang="ts">
	import { goto } from '$app/navigation';
	import { loginTicAdmin } from '$lib/utils/ticAdminAuth';

	let password = $state('');
	let error = $state('');

	function handleSubmit(e: Event) {
		e.preventDefault();
		const result = loginTicAdmin(password);
		if (!result.ok) {
			error = result.error;
			return;
		}
		goto('/tic-admin');
	}
</script>

<svelte:head>
	<title>TIC Admin · Sign in</title>
</svelte:head>

<section class="login">
	<div class="card">
		<div class="card__head">
			<p class="eyebrow">IITG TIC</p>
			<h1>Team admin</h1>
			<p class="sub">Sign in to manage companies and posted opportunities.</p>
		</div>

		<form onsubmit={handleSubmit} novalidate>
			<label class="field">
				<span>Password</span>
				<input
					type="password"
					bind:value={password}
					autocomplete="current-password"
					required
				/>
			</label>

			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<button type="submit">Sign in</button>
		</form>

		<p class="hint">For TIC team members only.</p>
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;

	.login {
		min-height: 100svh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f6f7f9;
		padding: 24px;
		font-family: $font-family-base;
	}

	.card {
		width: 100%;
		max-width: 380px;
		padding: 32px 28px 28px;
		background: #fff;
		border: 1px solid #e6e8ec;
		border-radius: 10px;
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
		color: #888;
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
			border: 1px solid #d8dbe0;
			border-radius: 6px;

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
		border-radius: 6px;
	}

	button {
		padding: 11px 16px;
		font: inherit;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #fff;
		background: #111;
		border: 1px solid #111;
		border-radius: 6px;
		cursor: pointer;

		&:hover {
			background: #000;
		}
	}

	.hint {
		margin: 18px 0 0;
		font-size: 12px;
		color: #888;
		text-align: center;
	}
</style>
