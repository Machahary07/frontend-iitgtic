<script lang="ts">
	import { page } from '$app/state';
	import content from '$lib/data/content.json';
	import { getJob, type AnyJob } from '$lib/utils/jobPostings';
	import { onMount } from 'svelte';
	import LinkReveal from '$lib/components/LinkReveal.svelte';

	const slug = $derived(page.params.id ?? '');

	function seedBySlug(s: string): AnyJob | null {
		const p = content.pages.opportunities.posts.find((x) => x.slug === s);
		if (!p) return null;
		return {
			id: `seed_${p.slug}`,
			slug: p.slug,
			companyId: '',
			role: p.role,
			company: p.company,
			companySlug: p.companySlug,
			location: p.location,
			type: p.type,
			sector: p.sector,
			posted: p.posted,
			description: p.description,
			applyLink: p.applyLink,
			createdAt: p.posted,
			updatedAt: p.posted,
			source: 'seed' as const
		};
	}

	let userJob = $state<AnyJob | null>(null);
	let resolved = $state(false);

	const job = $derived<AnyJob | null>(userJob ?? seedBySlug(slug));

	onMount(() => {
		userJob = getJob(slug);
		resolved = true;
	});

	function formatPosted(iso: string) {
		const d = new Date(iso);
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	const applyHref = $derived(job?.applyLink ?? '');
	const isExternal = $derived(applyHref.startsWith('http'));
</script>

<svelte:head>
	<title>{job ? `${job.role} · ${job.company}` : 'Role · IITG TIC'}</title>
</svelte:head>

<section class="detail">
	<div class="detail__inner">
		<LinkReveal href="/opportunities" text="← All roles" class="back" />

		<article class="card">
			{#if !job && resolved}
				<header class="detail__header">
					<h1>Role not found</h1>
					<p>This role may have been filled or removed.</p>
				</header>
			{:else if job}
				<header class="detail__header">
					<div class="meta-top">
						<span class="type-pill" class:type-pill--intern={job.type.startsWith('Internship')}>{job.type}</span>
						<span class="date">Posted {formatPosted(job.posted)}</span>
					</div>
					<h1>{job.role}</h1>
					<p class="company">{job.company}</p>
					<div class="meta-row">
						<span>{job.location}</span>
						<span class="dot" aria-hidden="true">·</span>
						<span>{job.sector}</span>
					</div>
				</header>

				<div class="body">
					<h2>About the role</h2>
					<p>{job.description}</p>
				</div>

				{#if applyHref}
					<div class="apply">
						<a
							class="apply__btn"
							href={applyHref}
							target={isExternal ? '_blank' : undefined}
							rel={isExternal ? 'noopener noreferrer' : undefined}
						>
							Apply to {job.company}
						</a>
						<p class="apply__hint">
							{applyHref.startsWith('mailto:')
								? 'Opens your mail client'
								: isExternal
									? 'Opens the company application page'
									: ''}
						</p>
					</div>
				{/if}
			{/if}
		</article>
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.detail {
		background: $color-white;
		color: $color-black;
		padding: calc(var(--page-shell-top, 104px) + #{$space-8}) $space-8 $space-10;
		font-family: $font-family-serif;

		@include breakpoint-down($bp-sm) {
			padding: calc(var(--page-shell-top, 100px) + #{$space-6}) $space-5 $space-8;
		}
	}

	.detail__inner {
		width: min(100%, $container-lg);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: $space-5;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: $space-6;
		padding: $space-6;
		border: 1px solid $color-black;
		background: $color-white;

		@include breakpoint-down($bp-sm) {
			border: 0;
			padding: 0;
			gap: $space-6;
		}
	}

	:global(.back) {
		@include eyebrow;
		color: $color-black;
		align-self: flex-start;
	}

	.detail__header {
		display: flex;
		flex-direction: column;
		gap: $space-3;
		padding-bottom: $space-5;
		border-bottom: 1px solid rgba($color-black, 0.12);
	}

	.meta-top {
		display: flex;
		align-items: center;
		gap: $space-3;
	}

	.type-pill {
		padding: 4px 10px;
		background: $color-black;
		color: $color-white;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		border-radius: $radius-sm;

		&--intern {
			background: $color-primary-green;
		}
	}

	.date {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.detail__header h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, #{$font-size-4xl});
		line-height: $line-height-tight;
		font-weight: $font-weight-regular;
		font-style: italic;
	}

	.company {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-lg;
		font-weight: $font-weight-semibold;
	}

	.meta-row {
		display: flex;
		flex-wrap: wrap;
		gap: $space-2;
		font-family: $font-family-base;
		font-size: $font-size-sm;
		color: rgba($color-black, 0.72);
	}

	.dot {
		color: rgba($color-black, 0.4);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: $space-3;

		h2 {
			@include eyebrow;
		}

		p {
			margin: 0;
			font-size: $font-size-md;
			line-height: $line-height-relaxed;
			white-space: pre-wrap;
			max-width: 64ch;
		}
	}

	.apply {
		display: flex;
		flex-direction: column;
		gap: $space-2;
		padding-top: $space-4;
		border-top: 1px solid rgba($color-black, 0.12);
	}

	.apply__btn {
		align-self: flex-start;
		padding: 11px 28px;
		background: $color-black;
		color: $color-white;
		font-family: $font-family-base;
		font-size: $font-size-sm;
		font-weight: $font-weight-bold;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-decoration: none;
		border: 1px solid $color-black;
	}

	.apply__hint {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		color: rgba($color-black, 0.55);
	}
</style>
