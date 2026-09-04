<script lang="ts">
	import LinkReveal from './LinkReveal.svelte';
	import { images } from '$lib/data/images';
	import { getContent } from '$lib/content';
	import { loadGsap, prefersReducedMotion } from '$lib/utils/animation';

	type FooterLink = { label: string; href: string };
	type FooterGroup = { title: string; links: FooterLink[] };
	type Social = { label: string; href: string; text: string };

	// Editable at /tic-admin/content → Global → Footer.
	const footer = getContent().footer;
	const linkGroups = footer.linkGroups as FooterGroup[];
	const socialLinks = footer.socials as Social[];
	const legalLinks = footer.legal as FooterLink[];

	const year = new Date().getFullYear();

	let email = $state('');
	let submitted = $state(false);
	let subscribing = $state(false);
	let subscribeError = $state('');
	let subscribeInner: HTMLElement;

	// This used to preventDefault and show "Thanks — we'll be in touch" without
	// storing anything, so the message was untrue. It posts to /api/newsletter
	// now, and only says thanks once the row is actually written.
	async function handleSubscribe(event: SubmitEvent) {
		event.preventDefault();
		if (subscribing) return;

		const address = email.trim();
		if (!address) return;

		subscribing = true;
		subscribeError = '';
		try {
			const res = await fetch('/api/newsletter', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: address })
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { message?: string };
				subscribeError = body.message ?? 'Could not subscribe just now. Please try again.';
				return;
			}

			submitted = true;
			email = '';
		} catch {
			subscribeError = 'Could not reach the server. Check your connection and try again.';
		} finally {
			subscribing = false;
		}
	}

	async function animateSubscribe(yPercent: number) {
		if (prefersReducedMotion()) return;
		const { gsap } = await loadGsap();
		gsap.to(subscribeInner, {
			yPercent,
			duration: 0.6,
			ease: 'hop',
			overwrite: true
		});
	}
</script>

<footer class="site-footer">
	<div class="footer-inner">
		<div class="footer-top">
			<div class="footer-intro">
				<div class="footer-brand">
					<span class="footer-logo">
						<img src={images.logo} alt="" loading="lazy" decoding="async" />
					</span>
					<span class="footer-tagline">{footer.tagline}</span>
				</div>

				<form class="footer-newsletter" onsubmit={handleSubscribe} novalidate>
					<h2>{footer.newsletter.heading}</h2>
					<p>{footer.newsletter.text}</p>
					<div class="newsletter-row">
						<label class="visually-hidden" for="footer-newsletter-email">Email address</label>
						<input
							id="footer-newsletter-email"
							type="email"
							name="email"
							placeholder="you@example.com"
							autocomplete="email"
							required
							bind:value={email}
						/>
						<button
							type="submit"
							class="newsletter-submit"
							disabled={subscribing}
							onmouseenter={() => animateSubscribe(-50)}
							onmouseleave={() => animateSubscribe(0)}
							onfocus={() => animateSubscribe(-50)}
							onblur={() => animateSubscribe(0)}
						>
							<span class="reveal-mask">
								<span class="reveal-wrapper" bind:this={subscribeInner}>
									<span class="reveal-item">Subscribe</span>
									<span class="reveal-item" aria-hidden="true">Subscribe</span>
								</span>
							</span>
						</button>
					</div>
					{#if submitted}
						<p class="newsletter-status" role="status">Thanks — we'll be in touch.</p>
					{:else if subscribeError}
						<p class="newsletter-status newsletter-status--error" role="alert">{subscribeError}</p>
					{/if}
				</form>

				<div class="footer-contact">
					<h2>{footer.contact.heading}</h2>
					<p class="footer-contact__line">{footer.contact.email}</p>
					<p class="footer-contact__line">{footer.contact.phone}</p>
				</div>
			</div>

			<nav class="footer-nav" aria-label="Footer navigation">
				{#each linkGroups as group}
					<div class="footer-group">
						<h2>{group.title}</h2>
						<ul>
							{#each group.links as link}
								<li>
									<LinkReveal text={link.label} href={link.href} class="footer-link" />
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</nav>
		</div>

		<div class="footer-bottom">
			<p>&copy; {year} IIT Guwahati Technology Incubation Centre</p>

			<nav class="footer-legal" aria-label="Legal">
				{#each legalLinks as link (link.href)}
					<LinkReveal text={link.label} href={link.href} class="footer-legal__link" />
				{/each}
			</nav>

			<div class="footer-socials" aria-label="Social links">
				{#each socialLinks as social}
					<a href={social.href} aria-label={social.label} target="_blank" rel="noopener noreferrer">
						<span>{social.text}</span>
					</a>
				{/each}
			</div>
		</div>
	</div>
</footer>

<style lang="scss">
	@use '$styles/variables' as *;

	.site-footer {
		background: $color-white;
		color: $color-black;
		padding: $space-10 $space-8 $space-7;
	}

	.footer-inner {
		width: min(100%, $container-lg);
		margin: 0 auto;
	}

	.footer-top {
		display: grid;
		grid-template-columns: minmax(260px, 1fr) minmax(520px, 1.7fr);
		gap: $space-10;
		padding-bottom: $space-8;
		border-bottom: 1px solid rgba($color-black, 0.32);
	}

	.footer-intro {
		display: flex;
		flex-direction: column;
		gap: $space-6;
	}

	.footer-brand {
		display: inline-flex;
		flex-direction: column;
		align-items: flex-start;
		gap: $space-3;
		width: fit-content;
		color: $color-black;
		font-size: $font-size-lg;
		font-weight: $font-weight-medium;
		line-height: $line-height-snug;
		text-decoration: none;
	}

	.footer-logo {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		flex: 0 0 auto;

		img {
			width: 34px;
			height: 34px;
			object-fit: contain;
		}
	}

	.footer-tagline {
		display: inline-block;
	}

	.footer-newsletter {
		display: flex;
		flex-direction: column;
		gap: $space-3;
		max-width: 360px;

		h2 {
			margin: 0;
			font-size: $font-size-base;
			line-height: $line-height-snug;
			font-weight: $font-weight-bold;
		}

		p {
			margin: 0;
			color: rgba($color-black, 0.72);
			font-size: $font-size-base;
			line-height: $line-height-snug;
		}
	}

	.newsletter-row {
		display: flex;
		align-items: stretch;
		gap: $space-2;
		margin-top: $space-2;

		input {
			flex: 1;
			min-width: 0;
			padding: $space-3 $space-4;
			border: 1px solid rgba($color-black, 0.32);
			background: $color-white;
			color: $color-black;
			font: inherit;
			font-size: $font-size-base;
			line-height: $line-height-snug;
			transition: border-color $transition-base;

			&::placeholder {
				color: rgba($color-black, 0.48);
			}

			&:focus-visible {
				outline: none;
				border-color: $color-black;
			}
		}

		.newsletter-submit:disabled {
			opacity: 0.55;
			cursor: not-allowed;
		}

		.newsletter-submit {
			padding: $space-3 $space-5;
			border: 1px solid $color-black;
			background: $color-black;
			color: $color-white;
			font: inherit;
			font-size: $font-size-base;
			font-weight: $font-weight-semibold;
			line-height: $line-height-snug;
			cursor: pointer;
		}

		.reveal-mask {
			display: block;
			overflow: hidden;
			height: $line-height-snug * 1em;
			line-height: $line-height-snug * 1em;
		}

		.reveal-wrapper {
			display: flex;
			flex-direction: column;
			will-change: transform;
		}

		.reveal-item {
			display: block;
			white-space: nowrap;
			height: $line-height-snug * 1em;
		}
	}

	.newsletter-status {
		margin: 0;
		color: rgba($color-black, 0.72);
		font-size: $font-size-sm;
		line-height: $line-height-snug;

		&--error {
			color: #9a1515;
		}
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.footer-contact {
		display: flex;
		flex-direction: column;
		gap: $space-2;

		h2 {
			margin: 0;
			font-size: $font-size-base;
			line-height: $line-height-snug;
			font-weight: $font-weight-bold;
		}
	}

	.footer-contact__line {
		margin: 0;
		color: rgba($color-black, 0.72);
		font-size: $font-size-base;
		line-height: $line-height-snug;
	}

	.footer-nav {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: $space-8;
	}

	.footer-group {
		h2 {
			margin: 0 0 $space-4;
			font-size: $font-size-base;
			line-height: $line-height-snug;
			font-weight: $font-weight-bold;
		}

		ul {
			display: grid;
			gap: $space-3;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		:global(.footer-link) {
			color: $color-black;
			font-size: $font-size-base;
			line-height: $line-height-snug;
		}
	}

	.footer-bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: $space-6;
		padding-top: $space-7;

		p {
			margin: 0;
			color: rgba($color-black, 0.88);
			font-size: $font-size-base;
			line-height: $line-height-snug;
		}
	}

	.footer-legal {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: $space-4;
	}

	:global(.footer-legal__link) {
		color: $color-black;
		font-size: $font-size-sm;
		line-height: $line-height-snug;
	}

	.footer-socials {
		display: flex;
		align-items: center;
		gap: $space-5;

		a {
			display: grid;
			place-items: center;
			min-width: 24px;
			height: 24px;
			color: $color-black;
			text-decoration: none;
			transition:
				color $transition-base,
				opacity $transition-base;

			&:hover,
			&:focus-visible {
				opacity: 0.72;
			}
		}

		span {
			font-size: $font-size-lg;
			line-height: 1;
			font-weight: $font-weight-bold;
		}
	}

	@media (max-width: 900px) {
		.site-footer {
			padding: $space-8 $space-5 $space-6;
		}

		.footer-top {
			grid-template-columns: 1fr;
			gap: $space-8;
		}

		.footer-nav {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: $space-5;
		}
	}

	@media (max-width: 640px) {
		.footer-nav {
			grid-template-columns: 1fr;
			gap: $space-7;
		}

		.footer-bottom {
			align-items: flex-start;
			flex-direction: column;
		}
	}

	@media (max-width: 420px) {
		.newsletter-row {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
