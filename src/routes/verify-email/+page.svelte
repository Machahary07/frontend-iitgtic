<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Confirm your email · IITG TIC</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="page">
	<div class="card">
		{#if data.ok}
			<p class="eyebrow">Email confirmation</p>
			<h1>Email confirmed</h1>
			<p class="sub">
				Thank you — your email is confirmed. You can now finish and submit your incubation
				application.
			</p>
			<div class="actions">
				<a class="btn-primary" href={resolve('/application')}>Continue your application</a>
				<a class="btn" href={resolve('/account')}>Go to your account</a>
			</div>
		{:else}
			<p class="eyebrow">Email confirmation</p>
			<h1>Link could not be used</h1>
			<p class="sub">
				This confirmation link is invalid or has expired. Open your application and use “Resend
				confirmation email” to get a fresh one.
			</p>
			<div class="actions">
				<a class="btn-primary" href={resolve('/application')}>Open your application</a>
				<a class="btn" href={resolve('/login')}>Sign in</a>
			</div>
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
		text-align: center;
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

	.actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 22px;
	}

	.btn-primary {
		@include admin-btn-primary;
		justify-content: center;
	}

	.btn {
		@include admin-btn-base;
		justify-content: center;
	}
</style>
