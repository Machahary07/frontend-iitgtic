<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import LinkReveal from '$lib/components/LinkReveal.svelte';
	import ButtonReveal from '$lib/components/ButtonReveal.svelte';
	import { loadUserSession, clearUserSession, type UserSession } from '$lib/utils/userSession';
	import {
		getMyApplications,
		type ApplicationStatus,
		type MyApplication
	} from '$lib/utils/applications';

	let loading = $state(true);
	let session = $state<UserSession>({});
	let applications = $state<MyApplication[]>([]);

	onMount(async () => {
		const s = await loadUserSession();
		if (!s.id) {
			// The account page is for signed-in founders — send anyone else to log in.
			goto(resolve('/login'));
			return;
		}
		session = s;
		applications = await getMyApplications();
		loading = false;
	});

	function startApplication() {
		goto(resolve('/application'));
	}

	async function logout(event: MouseEvent) {
		event.preventDefault();
		await clearUserSession();
		goto(resolve('/'));
	}

	const STATUS: Record<ApplicationStatus, { label: string; tone: string }> = {
		submitted: { label: 'Submitted', tone: 'neutral' },
		'under-review': { label: 'Under review', tone: 'amber' },
		accepted: { label: 'Accepted', tone: 'green' },
		rejected: { label: 'Declined', tone: 'red' }
	};

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Your account · IITG TIC</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="account">
	<div class="account__inner">
		<header class="account__header">
			<div>
				<h1>Your applications</h1>
				<p class="account__sub">
					{#if session.email}Signed in as {session.email}{/if}
				</p>
			</div>
			<LinkReveal href="/" text="Log out" class="account__logout inline-link" onclick={logout} />
		</header>

		<div class="account__actions">
			<ButtonReveal text="Start a new application" class="start" onclick={startApplication} />
		</div>

		{#if loading}
			<p class="account__status" role="status">Loading your applications…</p>
		{:else if applications.length === 0}
			<div class="empty">
				<h2 class="empty__title">No applications yet</h2>
				<p class="empty__body">
					When you submit an incubation application it appears here, and you can follow its status as
					the TIC committee reviews it.
				</p>
			</div>
		{:else}
			<ul class="apps">
				{#each applications as app (app.id)}
					<li class="app">
						<div class="app__head">
							<h2 class="app__name">{app.startup_name || 'Untitled application'}</h2>
							<span class="pill pill--{STATUS[app.status].tone}">
								<span class="pill__dot" aria-hidden="true"></span>
								{STATUS[app.status].label}
							</span>
						</div>
						<p class="app__meta">
							Submitted {formatDate(app.created_at)}
							{#if app.reviewed_at}· Updated {formatDate(app.reviewed_at)}{/if}
						</p>
						{#if app.review_note}
							<div class="app__note">
								<span class="app__note-label">Note from the reviewer</span>
								<p>{app.review_note}</p>
							</div>
						{/if}
						<div class="app__foot">
							<LinkReveal
								href={`/account/${app.id}`}
								text="View application"
								class="inline-link"
							/>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.account {
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

	.account__inner {
		width: 100%;
		max-width: 640px;
		padding-inline: $space-6;

		@include breakpoint-down($bp-sm) {
			padding-inline: $space-4;
		}
	}

	.account__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: $space-4;
		margin-bottom: $space-6;

		h1 {
			margin: 0 0 $space-2;
			font-size: $font-size-3xl;
			font-weight: $font-weight-bold;
			letter-spacing: $letter-spacing-tight;
		}
	}

	.account__sub {
		margin: 0;
		font-size: $font-size-sm;
		color: rgba($color-white, 0.85);
	}

	:global(.account__logout) {
		flex-shrink: 0;
		font-size: $font-size-sm;
		color: $color-white;
		font-weight: $font-weight-semibold;
	}

	:global(.inline-link) {
		color: $color-white;
		font-weight: $font-weight-semibold;
	}

	.account__actions {
		margin-bottom: $space-7;
	}

	:global(button.button-reveal.start) {
		padding: 11px 28px;
		border: 1px solid $color-black;
		background: $color-black;
		color: $color-white;
		font-size: $font-size-sm;
		font-weight: $font-weight-bold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
	}

	.account__status {
		margin: 0;
		font-size: $font-size-base;
		color: rgba($color-white, 0.85);
	}

	.empty {
		padding: $space-6;
		border: 1px solid rgba($color-white, 0.25);

		&__title {
			margin: 0 0 $space-2;
			font-size: $font-size-lg;
			font-weight: $font-weight-semibold;
		}

		&__body {
			margin: 0;
			font-size: $font-size-sm;
			line-height: 1.6;
			color: rgba($color-white, 0.85);
		}
	}

	.apps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: $space-4;
	}

	.app {
		padding: $space-5;
		border: 1px solid rgba($color-white, 0.25);
	}

	.app__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: $space-3;
		flex-wrap: wrap;
	}

	.app__name {
		margin: 0;
		font-size: $font-size-lg;
		font-weight: $font-weight-semibold;
	}

	.app__meta {
		margin: $space-2 0 0;
		font-size: $font-size-xs;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		color: rgba($color-white, 0.7);
	}

	.app__note {
		margin-top: $space-4;
		padding: $space-3 $space-4;
		background: rgba($color-white, 0.1);
		border-left: 2px solid rgba($color-white, 0.6);

		p {
			margin: 4px 0 0;
			font-size: $font-size-sm;
			line-height: 1.6;
			color: rgba($color-white, 0.92);
		}
	}

	.app__note-label {
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		color: rgba($color-white, 0.7);
	}

	.app__foot {
		margin-top: $space-4;
		font-size: $font-size-sm;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		flex-shrink: 0;
		padding: 4px 12px;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		background: rgba($color-white, 0.1);
		border: 1px solid rgba($color-white, 0.18);
		border-radius: 999px;
	}

	.pill__dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
	}

	.pill--neutral .pill__dot {
		background: rgba($color-white, 0.7);
	}
	.pill--amber .pill__dot {
		background: #ffd257;
	}
	.pill--green .pill__dot {
		background: #5fdc82;
	}
	.pill--red .pill__dot {
		background: #ff8a8a;
	}
</style>
