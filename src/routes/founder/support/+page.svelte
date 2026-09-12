<script lang="ts">
	import { resolve } from '$app/paths';
	import FounderShell from '$lib/components/FounderShell.svelte';
	import Mail from '@lucide/svelte/icons/mail';
	import Phone from '@lucide/svelte/icons/phone';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import { getContent } from '$lib/content';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Deliberately not the people who built the console. A founder's questions are
	// about their application, their verification and their postings, all of which
	// are TIC's to answer — so this page points at the centre, and is read from
	// the same contact copy the public site uses rather than hard-coded here.
	const details = $derived(getContent().pages.contact.details);
</script>

<svelte:head>
	<title>Founder Console · Support</title>
</svelte:head>

<FounderShell
	founder={data.founder}
	company={data.company}
	title="Support"
	eyebrow="Help"
	alwaysAvailable
>
	<div class="panel">
		<h2 class="panel__title">Who to contact</h2>
		<p class="lede">
			Anything about your incubation application, your company's verification, a posting waiting for
			approval or a team member waiting for access — the IITG-TIC team decides all of it, so ask
			them. Say which screen you were on and what you expected to happen.
		</p>

		<div class="contact">
			<span class="contact__initial" aria-hidden="true">T</span>
			<div class="contact__body">
				<p class="contact__name">{details.org}</p>
				<p class="contact__role">Technology Incubation Centre, IIT Guwahati</p>
				<div class="contact__rows">
					<p class="contact__row">
						<Mail size={15} strokeWidth={1.75} aria-hidden="true" />
						<a href="mailto:{details.email}">{details.email}</a>
					</p>
					<p class="contact__row">
						<Phone size={15} strokeWidth={1.75} aria-hidden="true" />
						<span class="contact__plain">{details.phone}</span>
					</p>
					<p class="contact__row contact__row--address">
						<MapPin size={15} strokeWidth={1.75} aria-hidden="true" />
						<span class="contact__plain">
							{#each details.addressLines as line, i (line)}
								{line}{#if i < details.addressLines.length - 1}<br />{/if}
							{/each}
						</span>
					</p>
				</div>
			</div>
		</div>

		<p class="foot">
			The public <a href={resolve('/contact')}>contact page</a> has the same details, a map, and an enquiry form
			if you would rather write from there.
		</p>
	</div>
</FounderShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.panel {
		@include admin-panel;
		padding: 20px;
	}

	.panel__title {
		@include admin-section-title;
		margin: 0 0 10px;
	}

	.lede {
		margin: 0 0 20px;
		font-size: 13px;
		line-height: 1.6;
		color: $admin-ink-2;
		max-width: 66ch;
	}

	.contact {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		padding: 18px;
		background: $admin-sunken;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		max-width: 460px;
	}

	.contact__initial {
		@include admin-icon-tile('info', 40px);
		font-family: $font-family-base;
		font-size: 15px;
		font-weight: $font-weight-semibold;
	}

	.contact__body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.contact__name {
		margin: 0;
		font-size: 15px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
	}

	.contact__role {
		margin: 0;
		font-size: 12px;
		color: $admin-ink-3;
	}

	.contact__rows {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 12px;
	}

	.contact__row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-size: 13px;
		color: $admin-ink-2;
		min-width: 0;

		:global(svg) {
			flex: none;
			color: $admin-ink-3;
		}

		a {
			color: $admin-accent;
			text-decoration: none;
			overflow-wrap: anywhere;
			@include admin-focus-ring($admin-accent);
		}

		&--address {
			align-items: flex-start;
			line-height: 1.5;
		}
	}

	.contact__plain {
		user-select: text;
	}

	.foot {
		margin: 18px 0 0;
		font-size: 12px;
		color: $admin-ink-3;

		a {
			color: $admin-accent;
			text-decoration: none;
			@include admin-focus-ring($admin-accent);
		}
	}
</style>
