<script lang="ts">
	import CallToAction from '$lib/components/CallToAction.svelte';
	import LinkReveal from '$lib/components/LinkReveal.svelte';
	import { getContent } from '$lib/content';
	import type { PageProps } from './$types';

	const content = getContent();

	let { data }: PageProps = $props();
	const post = $derived(data.post);
	const ctaContent = content.cta.apply;

	function formatDate(iso: string) {
		const d = new Date(iso);
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>{post.title} · IITG TIC</title>
</svelte:head>

<article class="post">
	<header class="post__header">
		<div class="post__meta">
			<span>{formatDate(post.date)}</span>
			{#if post.readTime}
				<span aria-hidden="true">·</span>
				<span>{post.readTime}</span>
			{/if}
		</div>
		<h1 class="post__title">{post.title}</h1>
		<p class="post__excerpt">{post.excerpt}</p>
		{#if post.author}
			<p class="post__author">By {post.author}</p>
		{/if}
	</header>

	{#if post.coverImage}
		<figure class="post__cover" aria-label={post.coverImage.alt}>
			<div class="post__cover-placeholder" aria-hidden="true"></div>
		</figure>
	{/if}

	<div class="post__body">
		{#each post.body as block, i (i)}
			{#if block.type === 'paragraph'}
				<p>{block.text}</p>
			{:else if block.type === 'heading'}
				<h2>{block.text}</h2>
			{:else if block.type === 'image'}
				<figure class="post__figure" aria-label={block.alt}>
					<div class="post__figure-placeholder" aria-hidden="true"></div>
					{#if block.caption}
						<figcaption>{block.caption}</figcaption>
					{/if}
				</figure>
			{/if}
		{/each}
	</div>

	<footer class="post__footer">
		<LinkReveal href="/about/blog" text="← Back to all writing" class="post__back" />
	</footer>
</article>

<CallToAction
	eyebrow={ctaContent.eyebrow}
	headlineLead={ctaContent.headlineLead}
	headlineEmphasis={ctaContent.headlineEmphasis}
	label={ctaContent.label}
	href={ctaContent.href}
/>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.post {
		background: $color-white;
		color: $color-black;
		padding: calc(var(--page-shell-top, 104px) + #{$space-8}) $space-8 $space-10;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.post__header {
		width: min(100%, $container-sm);
		display: flex;
		flex-direction: column;
		gap: $space-4;
		text-align: center;
		align-items: center;
		margin-bottom: $space-8;
	}

	.post__meta {
		@include eyebrow;
		display: inline-flex;
		gap: $space-3;
	}

	.post__title {
		margin: 0;
		font-family: $font-family-serif;
		font-size: clamp(2rem, 5vw, #{$font-size-5xl});
		line-height: $line-height-tight;
		font-weight: $font-weight-regular;
		font-style: italic;
		letter-spacing: $letter-spacing-tight;
		text-wrap: balance;
		max-width: 18ch;
	}

	.post__excerpt {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-md;
		line-height: $line-height-relaxed;
		color: rgba($color-black, 0.78);
		max-width: 56ch;
	}

	.post__author {
		@include eyebrow;
	}

	.post__cover {
		margin: 0 0 $space-9;
		width: min(100%, $container-md);
		display: flex;
		flex-direction: column;
	}

	.post__cover-placeholder {
		width: 100%;
		aspect-ratio: 16 / 9;
		background: $color-black;
	}

	.post__body {
		width: min(100%, $container-sm);
		display: flex;
		flex-direction: column;
		gap: $space-5;

		p {
			margin: 0;
			font-family: $font-family-serif;
			font-size: $font-size-md;
			line-height: $line-height-relaxed;
			color: rgba($color-black, 0.85);
		}

		h2 {
			margin: $space-5 0 0;
			font-family: $font-family-serif;
			font-size: clamp(1.5rem, 3vw, #{$font-size-3xl});
			line-height: $line-height-tight;
			font-weight: $font-weight-regular;
			font-style: italic;
			letter-spacing: $letter-spacing-tight;
			text-wrap: balance;
		}
	}

	.post__figure {
		margin: $space-5 0;
		display: flex;
		flex-direction: column;
		gap: $space-3;
	}

	.post__figure-placeholder {
		width: 100%;
		aspect-ratio: 16 / 9;
		background: $color-black;
	}

	.post__figure figcaption {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		letter-spacing: 0.04em;
		color: rgba($color-black, 0.6);
		text-align: center;
	}

	.post__footer {
		@include back-link-footer;
		width: min(100%, $container-sm);
		margin-top: $space-9;
	}

	:global(.post__back) {
		color: $color-black;
		font-family: $font-family-base;
		font-size: $font-size-sm;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.04em;
	}

	@include breakpoint-down($bp-sm) {
		.post {
			padding: calc(var(--page-shell-top, 100px) + #{$space-7}) $space-5 $space-9;
		}

		.post__header {
			margin-bottom: $space-6;
		}

		.post__cover {
			margin-bottom: $space-7;
		}

		.post__body {
			gap: $space-4;

			p {
				font-size: $font-size-base;
			}
		}

		.post__figure {
			margin: $space-4 0;
		}
	}
</style>
