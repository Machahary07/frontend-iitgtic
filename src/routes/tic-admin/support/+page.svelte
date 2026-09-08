<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import Mail from '@lucide/svelte/icons/mail';
	import Phone from '@lucide/svelte/icons/phone';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');

	// The people who built and maintain this console. The phone numbers are plain
	// text on purpose — this is a desktop tool, so a tel: link would open nothing.
	const contacts = [
		{
			name: 'Jeu Machahary',
			role: 'Site & admin console',
			email: 'hello@itsjeu.com',
			phone: '+91 7896175454'
		},
		{
			name: 'Veeshal D Bodosa',
			role: 'Site & admin console',
			email: 'veebodosa@gmail.com',
			phone: '+91 6000013904'
		}
	];

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/tic-admin/login'));
	}
</script>

<svelte:head>
	<title>TIC Admin · Support</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title="Support"
	eyebrow="Help"
	user={adminName}
	onLogout={handleLogout}
>
	<div class="panel">
		<h2 class="panel__title">Who to contact</h2>
		<p class="lede">
			Something broken, a page not saving, or a change you cannot make from here — reach either of
			us. Say which screen you were on and what you expected to happen.
		</p>

		<ul class="contacts">
			{#each contacts as person (person.email)}
				<li class="contact">
					<span class="contact__initial" aria-hidden="true">{person.name.charAt(0)}</span>
					<div class="contact__body">
						<p class="contact__name">{person.name}</p>
						<p class="contact__role">{person.role}</p>
						<div class="contact__rows">
							<p class="contact__row">
								<Mail size={15} strokeWidth={1.75} aria-hidden="true" />
								<a href="mailto:{person.email}">{person.email}</a>
							</p>
							<p class="contact__row">
								<Phone size={15} strokeWidth={1.75} aria-hidden="true" />
								<span class="contact__phone">{person.phone}</span>
							</p>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	</div>
</AdminShell>

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
		max-width: 62ch;
	}

	.contacts {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 14px;
	}

	.contact {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		padding: 18px;
		background: $admin-sunken;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
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
		gap: 6px;
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
	}

	.contact__phone {
		// Plain text rather than a link, and selectable so it can be copied out.
		user-select: text;
		font-variant-numeric: tabular-nums;
	}
</style>
