<script lang="ts">
	import { untrack } from 'svelte';
	import Select from '$lib/components/Select.svelte';
	import {
		JOB_TYPES,
		MAX_APPLICANTS,
		WORK_MODES,
		today,
		type JobFields
	} from '$lib/utils/jobPostings';

	// The one posting form, used by the TIC console for the centre's roles and by
	// the founder console for a startup's. TIC's roles are always IITG TIC, so the
	// company field only shows for a startup.

	let {
		initial,
		showCompany,
		intro,
		submitLabel,
		cancelHref,
		onsubmit
	}: {
		initial: JobFields;
		showCompany: boolean;
		intro: string;
		submitLabel: string;
		cancelHref: string;
		onsubmit: (fields: JobFields) => Promise<void>;
	} = $props();

	// Seeded once and then owned by whoever is typing; re-seeding mid-edit would
	// throw away what they had written.
	let f = $state<JobFields>(untrack(() => ({ ...initial })));
	let submitting = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (submitting) return;
		submitting = true;
		try {
			await onsubmit({ ...f });
		} finally {
			submitting = false;
		}
	}
</script>

<form class="card" onsubmit={handleSubmit} novalidate>
	<p class="card__sub">{intro}</p>

	<label class="field">
		<span>Role title</span>
		<input type="text" bind:value={f.role} placeholder="e.g. Embedded Firmware Engineer" required />
	</label>

	{#if showCompany}
		<label class="field">
			<span>Company name (shown to applicants)</span>
			<input type="text" bind:value={f.company} required />
		</label>
	{/if}

	<div class="row">
		<div class="field">
			<span class="field__label">Type</span>
			<Select
				id="job-type"
				bind:value={f.type}
				options={JOB_TYPES.map((t) => ({ value: t, label: t }))}
				ariaLabel="Type of role"
			/>
		</div>

		<div class="field">
			<span class="field__label">Work mode</span>
			<Select
				id="job-mode"
				bind:value={f.workMode}
				options={WORK_MODES.map((m) => ({ value: m, label: m }))}
				ariaLabel="Work mode"
			/>
		</div>
	</div>

	<div class="row">
		<label class="field">
			<span>Location</span>
			<input type="text" bind:value={f.location} placeholder="e.g. Guwahati" required />
		</label>

		<label class="field">
			<span>Sector / domain <em>(optional)</em></span>
			<input type="text" bind:value={f.sector} placeholder="e.g. Agricultural automation" />
		</label>
	</div>

	<div class="row">
		<label class="field">
			<span>Pay / stipend <em>(optional)</em></span>
			<input type="text" bind:value={f.pay} placeholder="e.g. ₹25,000 / month" />
		</label>

		<label class="field">
			<span>Closing date <em>(optional)</em></span>
			<input type="date" bind:value={f.closesOn} min={today()} />
		</label>
	</div>

	<label class="field field--narrow">
		<span>Application limit <em>(1–{MAX_APPLICANTS})</em></span>
		<input type="number" bind:value={f.maxApplicants} min="1" max={MAX_APPLICANTS} step="1" />
		<small>The role closes itself once this many people apply.</small>
	</label>

	<label class="field">
		<span>Role description</span>
		<textarea
			bind:value={f.description}
			rows="7"
			placeholder="What the person will work on, and what you are looking for."
			required
		></textarea>
	</label>

	<div class="actions">
		<button type="submit" class="btn-primary" disabled={submitting}>
			{submitting ? 'Saving…' : submitLabel}
		</button>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a class="btn" href={cancelHref}>Cancel</a>
	</div>
</form>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;
	@use '$styles/mixins' as *;

	.card {
		@include admin-card;
		max-width: 680px;
	}

	.card__sub {
		margin: 0;
		font-size: 13px;
		color: $admin-ink-2;
		line-height: 1.5;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;

		@include breakpoint-down($bp-sm) {
			grid-template-columns: 1fr;
		}
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;

		> span,
		.field__label {
			@include admin-field-label;
		}

		em {
			font-style: normal;
			font-weight: $font-weight-regular;
			color: $admin-ink-3;
		}

		input,
		textarea {
			@include admin-input;
		}

		textarea {
			resize: vertical;
			min-height: 140px;
			font-family: $font-family-base;
		}

		small {
			font-size: 12px;
			color: $admin-ink-3;
		}

		&--narrow {
			max-width: 320px;
		}
	}

	.actions {
		display: flex;
		gap: 10px;
		margin-top: 4px;
		flex-wrap: wrap;
	}

	.btn-primary {
		@include admin-btn-primary;
	}

	.btn {
		@include admin-btn-base;
		text-decoration: none;
	}
</style>
