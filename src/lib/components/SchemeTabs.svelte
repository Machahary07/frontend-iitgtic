<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	// The Schemes menu item opens on the overview; the tabs are how a visitor
	// moves between it and the pages that sit under it.
	// Active state is matched on the route id: resolve() can hand back a
	// relative href during SSR, which would never equal the current pathname.
	const tabs = [
		{ label: 'All schemes', route: '/schemes', href: resolve('/schemes') },
		{ label: 'Funding', route: '/schemes/funding', href: resolve('/schemes/funding') }
	];
</script>

<nav class="tabs" aria-label="Schemes">
	<ul class="tabs__list">
		{#each tabs as tab (tab.route)}
			<li>
				<a
					class="tabs__link"
					href={tab.href}
					aria-current={page.route.id === tab.route ? 'page' : undefined}
				>
					{tab.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.tabs {
		border-bottom: 1px solid rgba($color-black, 0.12);
		// A third tab should scroll on a narrow phone rather than wrap or push
		// the page sideways.
		overflow-x: auto;
		scrollbar-width: none;
	}

	.tabs__list {
		list-style: none;
		display: flex;
		gap: $space-6;
		margin: 0;
		padding: 0;
	}

	.tabs__link {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		// Sits over the nav's bottom border so the active underline replaces it.
		margin-bottom: -1px;
		border-bottom: 2px solid transparent;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		white-space: nowrap;
		text-decoration: none;
		color: rgba($color-black, 0.5);
		transition: color 160ms ease;

		&:hover {
			color: $color-black;
		}

		&:focus-visible {
			@include focus-ring;
		}

		&[aria-current='page'] {
			color: $color-black;
			border-bottom-color: $color-black;
		}
	}
</style>
