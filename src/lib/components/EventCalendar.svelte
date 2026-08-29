<script lang="ts">
	import LinkReveal from './LinkReveal.svelte';
	import { getContent } from '$lib/content';

	const content = getContent();

	type Post = (typeof content.pages.events.posts)[number];

	interface Props {
		eyebrow?: string;
		headlineLead?: string;
		headlineEmphasis?: string;
	}

	let {
		eyebrow = 'Calendar',
		headlineLead = 'What’s coming up',
		headlineEmphasis = 'at the centre.'
	}: Props = $props();

	const posts = content.pages.events.posts as Post[];
	const eventsByDate = new Map<string, Post>();
	for (const p of posts) eventsByDate.set(p.date, p);

	const monthNames = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const firstUpcoming = posts.find((p) => new Date(p.date) >= today);
	const initialDate = firstUpcoming ? new Date(firstUpcoming.date) : today;

	let year = $state(initialDate.getFullYear());
	let month = $state(initialDate.getMonth());
	let selectedISO = $state<string | null>(firstUpcoming?.date ?? null);

	type Filter = 'month' | 'all' | 'upcoming' | 'past';
	let filter = $state<Filter>('month');
	let filterOpen = $state(false);

	let listEl: HTMLDivElement | null = $state(null);
	let filterRoot: HTMLDivElement | null = $state(null);

	function isoOf(y: number, m: number, d: number) {
		return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
	}
	function isPast(y: number, m: number, d: number) {
		return new Date(y, m, d) < today;
	}
	function isToday(y: number, m: number, d: number) {
		return y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
	}
	function formatLong(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	type Cell = {
		day: number | null;
		iso: string | null;
		hasEvent: boolean;
		past: boolean;
		today: boolean;
	};

	const calendarCells: Cell[] = $derived.by(() => {
		const cells: Cell[] = [];
		const firstDay = new Date(year, month, 1);
		const offset = (firstDay.getDay() + 6) % 7; // Monday-first
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		for (let i = 0; i < offset; i++)
			cells.push({ day: null, iso: null, hasEvent: false, past: false, today: false });
		for (let d = 1; d <= daysInMonth; d++) {
			const iso = isoOf(year, month, d);
			cells.push({
				day: d,
				iso,
				hasEvent: eventsByDate.has(iso),
				past: isPast(year, month, d),
				today: isToday(year, month, d)
			});
		}
		while (cells.length < 42)
			cells.push({ day: null, iso: null, hasEvent: false, past: false, today: false });
		return cells;
	});

	const visibleEvents = $derived.by(() => {
		const tagged = posts.map((p) => ({ ...p, past: new Date(p.date) < today }));
		const list = tagged.filter((p) => {
			if (filter === 'all') return true;
			if (filter === 'past') return p.past;
			if (filter === 'upcoming') return !p.past;
			// 'month'
			const d = new Date(p.date);
			return d.getFullYear() === year && d.getMonth() === month;
		});
		list.sort((a, b) => {
			if (a.past !== b.past) return a.past ? 1 : -1;
			return new Date(a.date).getTime() - new Date(b.date).getTime();
		});
		return list;
	});

	const filterLabel = $derived.by(() => {
		switch (filter) {
			case 'all':
				return 'All events';
			case 'upcoming':
				return 'Upcoming events';
			case 'past':
				return 'Past events';
			default:
				return `${monthNames[month]} events`;
		}
	});

	function pickFilter(f: Filter) {
		filter = f;
		filterOpen = false;
	}

	function handleDocClick(e: MouseEvent) {
		if (!filterOpen || !filterRoot) return;
		if (!filterRoot.contains(e.target as Node)) filterOpen = false;
	}
	function handleDocKey(e: KeyboardEvent) {
		if (e.key === 'Escape') filterOpen = false;
	}

	function prevMonth() {
		if (month === 0) {
			month = 11;
			year--;
		} else month--;
	}
	function nextMonth() {
		if (month === 11) {
			month = 0;
			year++;
		} else month++;
	}

	function selectDay(iso: string) {
		selectedISO = iso;
		if (!eventsByDate.has(iso)) return;
		queueMicrotask(() => {
			if (!listEl) return;
			const target = listEl.querySelector<HTMLElement>(`[data-iso="${iso}"]`);
			if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
	}
</script>

<svelte:window onclick={handleDocClick} onkeydown={handleDocKey} />

<section class="calendar-section">
	<div class="calendar-section__inner">
		<header class="calendar-section__head">
			<p class="calendar-section__eyebrow">{eyebrow}</p>
			<h2 class="calendar-section__headline">
				{headlineLead}
				{#if headlineEmphasis}
					<em>{headlineEmphasis}</em>
				{/if}
			</h2>
		</header>

		<div class="layout">
			<div class="calendar">
				<div class="calendar-header">
					<button class="nav-btn" aria-label="Previous month" onclick={prevMonth}>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<polyline points="15 18 9 12 15 6" />
						</svg>
					</button>
					<div class="month-title">{monthNames[month]} {year}</div>
					<button class="nav-btn" aria-label="Next month" onclick={nextMonth}>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</button>
				</div>

				<div class="weekdays">
					<div>M</div>
					<div>T</div>
					<div>W</div>
					<div>T</div>
					<div>F</div>
					<div>S</div>
					<div>S</div>
				</div>

				<div class="days">
					{#each calendarCells as cell, i (i)}
						{#if cell.day === null}
							<div class="day empty"></div>
						{:else}
							<button
								class="day"
								class:event={cell.hasEvent && !cell.past}
								class:past-event={cell.hasEvent && cell.past}
								class:selected={selectedISO === cell.iso}
								class:today={cell.today}
								onclick={() => selectDay(cell.iso!)}
							>
								{cell.day}
							</button>
						{/if}
					{/each}
				</div>

				<div class="legend">
					<div class="legend-item"><span class="dot dot--selected"></span> Selected</div>
					<div class="legend-item"><span class="dot dot--upcoming"></span> Upcoming</div>
					<div class="legend-item"><span class="dot dot--past"></span> Past event</div>
				</div>
			</div>

			<div class="events-cell">
				<div class="events-panel">
					<div class="events-header">
						<div class="filter" bind:this={filterRoot}>
							<button
								type="button"
								class="filter-trigger"
								class:is-open={filterOpen}
								aria-haspopup="listbox"
								aria-expanded={filterOpen}
								onclick={(e) => {
									e.stopPropagation();
									filterOpen = !filterOpen;
								}}
							>
								<span>{filterLabel}</span>
								<svg
									class="filter-caret"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<polyline points="6 9 12 15 18 9" />
								</svg>
							</button>
							{#if filterOpen}
								<div class="filter-menu" role="listbox">
									<button
										type="button"
										role="option"
										aria-selected={filter === 'all'}
										class="filter-option"
										class:is-active={filter === 'all'}
										onclick={() => pickFilter('all')}
									>
										All events
									</button>
									<button
										type="button"
										role="option"
										aria-selected={filter === 'upcoming'}
										class="filter-option"
										class:is-active={filter === 'upcoming'}
										onclick={() => pickFilter('upcoming')}
									>
										Upcoming events
									</button>
									<button
										type="button"
										role="option"
										aria-selected={filter === 'past'}
										class="filter-option"
										class:is-active={filter === 'past'}
										onclick={() => pickFilter('past')}
									>
										Past events
									</button>
									<button
										type="button"
										role="option"
										aria-selected={filter === 'month'}
										class="filter-option"
										class:is-active={filter === 'month'}
										onclick={() => pickFilter('month')}
									>
										{monthNames[month]} events
									</button>
								</div>
							{/if}
						</div>
						<span class="events-count">{visibleEvents.length}</span>
					</div>
					<div class="events-scroll">
						<div class="events-list" bind:this={listEl}>
							{#if visibleEvents.length === 0}
								<div class="empty-state">
									<div class="es-icon">
										<svg
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="1.8"
											stroke-linecap="round"
											stroke-linejoin="round"
											aria-hidden="true"
										>
											<rect x="3" y="4.5" width="18" height="16" rx="2.5" />
											<line x1="3" y1="10" x2="21" y2="10" />
											<line x1="8" y1="3" x2="8" y2="6" />
											<line x1="16" y1="3" x2="16" y2="6" />
										</svg>
									</div>
									<div class="es-title">No events to show</div>
									<div class="es-sub">Try a different filter or browse another month.</div>
								</div>
							{:else}
								{#each visibleEvents as ev (ev.slug)}
									<article
										class="event-card"
										class:is-past={ev.past}
										class:active={selectedISO === ev.date}
										data-iso={ev.date}
									>
										<div class="card-top">
											<span class="card-date">{formatLong(ev.date)}</span>
											<span class="card-badge" class:card-badge--past={ev.past}>
												{ev.past ? 'Past' : 'Upcoming'}
											</span>
										</div>
										<h4 class="card-title"><em>{ev.title}</em></h4>
										<p class="card-excerpt">{ev.excerpt}</p>
										{#if ev.past}
											<span class="card-cta card-cta--disabled">Event ended</span>
										{:else}
											<LinkReveal
												href={`/events/${ev.slug}`}
												text="Discover event"
												class="card-cta"
											/>
										{/if}
									</article>
								{/each}
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.calendar-section {
		@include page-section;
	}

	.calendar-section__inner {
		@include section-inner($container-lg, $space-7);
	}

	.calendar-section__head {
		display: flex;
		flex-direction: column;
		gap: $space-3;
	}

	.calendar-section__eyebrow {
		@include eyebrow;
	}

	.calendar-section__headline {
		margin: 0;
		font-family: $font-family-serif;
		font-size: clamp(1.5rem, 3.6vw, #{$font-size-4xl});
		line-height: $line-height-tight;
		font-weight: $font-weight-regular;
		letter-spacing: $letter-spacing-tight;
		text-wrap: balance;
		max-width: 22ch;

		em {
			font-style: italic;
		}
	}

	.layout {
		display: grid;
		grid-template-columns: 1.15fr 1fr;
		gap: $space-5;
		align-items: stretch;

		@include breakpoint-down($bp-md) {
			grid-template-columns: 1fr;
		}
	}

	/* ---------- Calendar block ---------- */
	.calendar {
		background: $color-black;
		color: $color-white;
		padding: $space-6;
		display: flex;
		flex-direction: column;
		gap: $space-5;
	}

	.calendar-header {
		display: grid;
		grid-template-columns: 36px 1fr 36px;
		align-items: center;
	}

	.nav-btn {
		@include reset-button;
		width: 32px;
		height: 32px;
		border-radius: $radius-circle;
		background: rgba($color-white, 0.08);
		color: $color-white;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background $transition-base;

		&:hover {
			background: rgba($color-white, 0.18);
		}

		svg {
			width: 14px;
			height: 14px;
		}
	}

	.month-title {
		text-align: center;
		font-family: $font-family-base;
		font-size: $font-size-lg;
		font-weight: $font-weight-semibold;
	}

	.weekdays {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 6px;
	}

	.weekdays div {
		text-align: center;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba($color-white, 0.55);
		padding: 6px 0;
	}

	.days {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		grid-template-rows: repeat(6, 1fr);
		gap: 6px;
	}

	.day {
		@include reset-button;
		aspect-ratio: 1 / 1;
		background: rgba($color-white, 0.06);
		color: $color-white;
		font-family: $font-family-base;
		font-size: $font-size-base;
		font-weight: $font-weight-medium;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		border-radius: $radius-sm;
		transition: background $transition-base;

		&:hover:not(.empty):not(.selected) {
			background: rgba($color-white, 0.14);
		}

		&.empty {
			background: transparent;
			cursor: default;
			pointer-events: none;
		}

		&.today {
			box-shadow: inset 0 0 0 1px $color-accent-blue;
		}

		&.event {
			background: $color-primary-green;
			color: $color-white;
			font-weight: $font-weight-semibold;
		}

		&.past-event {
			background: rgba($color-white, 0.12);
			color: rgba($color-white, 0.55);
			text-decoration: line-through;
			text-decoration-color: rgba($color-white, 0.35);
		}

		&.selected {
			background: $color-accent-blue;
			color: $color-white;
		}

		&.event::after,
		&.past-event::after {
			content: '';
			position: absolute;
			top: 5px;
			right: 5px;
			width: 5px;
			height: 5px;
			border-radius: $radius-circle;
			background: $color-white;
		}

		&.selected.event,
		&.selected.past-event {
			background: $color-accent-blue;
			color: $color-white;
			text-decoration: none;
		}
	}

	.legend {
		display: flex;
		gap: $space-5;
		flex-wrap: wrap;
		justify-content: center;
		margin-top: $space-2;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba($color-white, 0.6);
	}

	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: $space-2;
	}

	.dot {
		width: 9px;
		height: 9px;
		border-radius: $radius-circle;
	}
	.dot--selected {
		background: $color-accent-blue;
	}
	.dot--upcoming {
		background: $color-primary-green;
	}
	.dot--past {
		background: rgba($color-white, 0.25);
	}

	/* ---------- Events panel ---------- */
	.events-cell {
		position: relative;
		min-height: 0;
		min-width: 0;

		@include breakpoint-down($bp-md) {
			height: 560px;
		}
	}

	.events-panel {
		position: absolute;
		inset: 0;
		background: $color-white;
		border: 1px solid $color-black;
		display: flex;
		flex-direction: column;
		overflow: hidden;

		@include breakpoint-down($bp-md) {
			position: relative;
			inset: auto;
			height: 100%;
		}
	}

	.events-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: $space-3;
		padding: $space-5 $space-5 $space-4;
		border-bottom: 1px solid rgba($color-black, 0.08);
		flex-shrink: 0;
	}

	.filter {
		position: relative;
	}

	.filter-trigger {
		@include reset-button;
		display: inline-flex;
		align-items: center;
		gap: $space-2;
		padding: $space-2 $space-3;
		margin: -#{$space-2} -#{$space-3};
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
		border-radius: $radius-sm;
		transition: background $transition-base, color $transition-base;

		&:hover,
		&.is-open {
			background: rgba($color-black, 0.05);
			color: $color-black;
		}
	}

	.filter-caret {
		width: 12px;
		height: 12px;
		flex-shrink: 0;
		transition: transform $transition-base;
	}

	.filter-trigger.is-open .filter-caret {
		transform: rotate(180deg);
	}

	.filter-menu {
		position: absolute;
		top: calc(100% + #{$space-2});
		left: -#{$space-3};
		z-index: $z-dropdown;
		display: flex;
		flex-direction: column;
		min-width: 200px;
		background: $color-white;
		border: 1px solid $color-black;
		box-shadow: $shadow-md;
		padding: $space-1;
	}

	.filter-option {
		@include reset-button;
		display: block;
		width: 100%;
		text-align: left;
		padding: $space-2 $space-3;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba($color-black, 0.7);
		border-radius: $radius-sm;
		transition: background $transition-base, color $transition-base;

		& + & {
			border-top: 1px solid rgba($color-black, 0.06);
		}

		&:hover {
			background: rgba($color-black, 0.04);
			color: $color-black;
		}

		&.is-active {
			background: $color-black;
			color: $color-white;
		}
	}

	.events-count {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		color: rgba($color-black, 0.45);
	}

	.events-scroll {
		flex: 1 1 0;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		scroll-behavior: smooth;
		scrollbar-width: thin;
		scrollbar-color: rgba($color-black, 0.35) transparent;

		&::-webkit-scrollbar {
			width: 6px;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: rgba($color-black, 0.25);
			border-radius: $radius-pill;
		}
		&::-webkit-scrollbar-thumb:hover {
			background: rgba($color-black, 0.45);
		}
	}

	.events-list {
		display: flex;
		flex-direction: column;
	}

	.event-card {
		display: flex;
		flex-direction: column;
		gap: $space-3;
		padding: $space-5;
		background: $color-white;
		color: $color-black;
		border-bottom: 1px solid rgba($color-black, 0.08);
		scroll-margin-top: $space-2;
		transition: background $transition-base;

		&:last-child {
			border-bottom: 0;
		}

		&.is-past {
			background: rgba($color-black, 0.03);
		}

		&.active {
			background: rgba($color-accent-blue, 0.06);
			box-shadow: inset 3px 0 0 0 $color-accent-blue;
		}
	}

	.card-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: $space-3;
	}

	.card-date {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.card-badge {
		padding: 4px 10px;
		background: $color-primary-green;
		color: $color-white;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		border-radius: $radius-sm;
		white-space: nowrap;
	}

	.card-badge--past {
		background: rgba($color-black, 0.08);
		color: rgba($color-black, 0.6);
	}

	.card-title {
		margin: 0;
		color: $color-black;
		font-family: $font-family-serif;
		font-size: $font-size-xl;
		line-height: $line-height-tight;
		font-weight: $font-weight-regular;
		letter-spacing: $letter-spacing-tight;

		em {
			font-style: italic;
		}
	}

	.card-excerpt {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		line-height: $line-height-base;
		color: rgba($color-black, 0.7);
		max-width: 48ch;
	}

	:global(.card-cta) {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		padding: $space-2 $space-5;
		margin-top: $space-2;
		background: $color-black;
		color: $color-white;
		border-radius: $radius-pill;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		font-weight: $font-weight-semibold;
		font-style: italic;
		text-decoration: none;
		white-space: nowrap;
	}

	.card-cta--disabled {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		padding: $space-2 $space-5;
		margin-top: $space-2;
		background: rgba($color-black, 0.08);
		color: rgba($color-black, 0.45);
		border-radius: $radius-pill;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		font-weight: $font-weight-semibold;
		font-style: italic;
		white-space: nowrap;
		cursor: not-allowed;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: $space-2;
		padding: $space-8 $space-5;
		color: rgba($color-black, 0.55);
	}

	.es-icon {
		width: 40px;
		height: 40px;
		color: rgba($color-black, 0.4);
	}

	.es-icon svg {
		width: 100%;
		height: 100%;
	}

	.es-title {
		font-family: $font-family-serif;
		font-size: $font-size-lg;
		font-style: italic;
		color: $color-black;
	}

	.es-sub {
		font-family: $font-family-base;
		font-size: $font-size-base;
	}

	@include breakpoint-down($bp-sm) {
		.calendar-section {
			@include page-section-mobile;
		}

		.calendar {
			padding: $space-5;
		}

		.event-card {
			padding: $space-4;
		}

		.events-header {
			padding: $space-4 $space-4 $space-3;
		}
	}
</style>
