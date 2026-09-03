<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { supabase } from '$lib/supabaseClient';
	import { safeNext } from '$lib/utils/authRedirect';

	// The landing page for every link Supabase mails out. Two shapes reach it:
	//
	//   implicit (the default)  #access_token=…&refresh_token=…&type=signup
	//   pkce                    ?code=…
	//
	// In the implicit case the client has already consumed the fragment and
	// cleared it from the address bar by the time getSession() resolves — it
	// awaits the same initialize() that does the detecting. So this page only has
	// to decide where the person goes next, and say something useful when the
	// link has expired.

	let failure = $state('');
	let done = $state(false);
	// signup / recovery / invite — the same callback serves all of them, and only
	// the wording on screen needs to differ.
	let kind = $state('signup');

	const heading = $derived(kind === 'recovery' ? 'Password reset' : 'Email confirmation');

	function describe(code: string | null, description: string | null): string {
		const text = description?.replace(/\+/g, ' ') ?? '';
		if (code === 'access_denied' || /expired/i.test(text)) {
			return kind === 'recovery'
				? 'This reset link has expired or has already been used. Ask for a new one.'
				: 'This confirmation link has expired or has already been used. Sign in to have a new one sent.';
		}
		return text || 'We could not confirm this link. Please try again.';
	}

	onMount(async () => {
		const url = new URL(window.location.href);
		const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
		const next = safeNext(url.searchParams.get('next'), '/');
		kind = hash.get('type') ?? url.searchParams.get('type') ?? 'signup';

		const errorCode = hash.get('error') ?? url.searchParams.get('error');
		if (errorCode) {
			failure = describe(
				errorCode,
				hash.get('error_description') ?? url.searchParams.get('error_description')
			);
			return;
		}

		const code = url.searchParams.get('code');
		if (code) {
			const { error } = await supabase.auth.exchangeCodeForSession(code);
			if (error) {
				failure = describe(null, error.message);
				return;
			}
		}

		const { data } = await supabase.auth.getSession();
		if (!data.session) {
			// Confirmed, but the link was opened in a different browser to the one
			// that signed up, so there is no session to carry forward.
			failure =
				kind === 'recovery'
					? 'This reset link is no longer valid — open it in the browser you asked from, or ask for a new one.'
					: 'Your email is confirmed. Please sign in to continue.';
			return;
		}

		done = true;
		// `next` is a runtime value, so there is no route id to resolve it against.
		// safeNext() has already held it to a path on this site.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(next, { replaceState: true });
	});
</script>

<svelte:head>
	<title>Confirming your email · IITG TIC</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="page">
	<div class="card">
		{#if failure}
			<p class="eyebrow">{heading}</p>
			<h1>Link could not be used</h1>
			<p class="sub">{failure}</p>
			<div class="actions">
				<a class="btn-primary" href={resolve('/opportunities/job-posting-admin')}>Company sign in</a
				>
				<a class="btn" href={resolve('/login')}>Founder sign in</a>
			</div>
		{:else}
			<p class="eyebrow">{heading}</p>
			<h1>{done ? 'Confirmed' : 'Confirming…'}</h1>
			<p class="sub">
				{#if kind === 'recovery'}
					{done ? 'Taking you to the password form.' : 'One moment while we check your link.'}
				{:else}
					{done ? 'Taking you to your dashboard.' : 'One moment while we verify your address.'}
				{/if}
			</p>
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
