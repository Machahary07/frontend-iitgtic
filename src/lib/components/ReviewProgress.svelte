<script lang="ts" module>
	// The six hand-offs an application passes through, in order. A row's stage is
	// the one in progress right now: earlier dots read as done, it glows, later
	// ones stay dim. 0 means it has not reached the first yet.
	export const REVIEW_STAGES = [
		{
			label: 'Admin check',
			role: 'Admin',
			color: '#e5484d',
			detail: 'Checked by admin, ready for the CEO.'
		},
		{
			label: 'CEO review',
			role: 'CEO',
			color: '#f76b15',
			detail: 'CEO reviews and assigns coordinators.'
		},
		{
			label: 'Coordinator review',
			role: 'Coordinators',
			color: '#f5a524',
			detail: 'Assigned coordinators review it.'
		},
		{
			label: 'CEO recheck',
			role: 'CEO',
			color: '#d6c31f',
			detail: 'CEO rechecks the coordinators’ notes.'
		},
		{
			label: 'TIC head review',
			role: 'TIC head',
			color: '#8bc34a',
			detail: 'Final review, then admin sends the welcome email.'
		},
		{
			label: 'Live',
			role: 'Admin',
			color: '#30a46c',
			detail: 'Listed among the live incubated startups.'
		}
	] as const;

	export type ReviewStage = 0 | 1 | 2 | 3 | 4 | 5 | 6;
</script>

<script lang="ts">
	// A rejected application stops where it was turned down: the dots before it
	// stay filled and that step is marked with a red cross instead of glowing.
	let { stage, rejected = false }: { stage: ReviewStage; rejected?: boolean } = $props();

	const current = $derived(stage > 0 ? REVIEW_STAGES[stage - 1] : null);
	const caption = $derived.by(() => {
		if (rejected)
			return current ? `Rejected at ${stage}/6 · ${current.label}` : 'Rejected before admin check';
		return current ? `${stage}/6 · ${current.label}` : 'Awaiting admin';
	});
</script>

<div class="progress" role="img" aria-label={caption}>
	<span class="dots">
		{#each REVIEW_STAGES as s, i (s.label)}
			<span
				class="dot"
				class:dot--done={i + 1 < stage}
				class:dot--active={!rejected && i + 1 === stage}
				class:dot--rejected={rejected && i + 1 === stage}
				style:--c={s.color}
			></span>
		{/each}
	</span>
	<span class="caption" class:caption--rejected={rejected} style:--c={current?.color}>
		{caption}
	</span>
</div>

<style lang="scss">
	.progress {
		display: inline-flex;
		flex-direction: column;
		gap: 5px;
		margin-top: 8px;
	}

	.dots {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}

	.caption {
		font-size: 11px;
		font-weight: 600;
		color: color-mix(in srgb, var(--c, #878e97) 78%, black);
		white-space: nowrap;

		&--rejected {
			color: #b4232a;
		}
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--c);
		opacity: 0.18;

		&--done {
			opacity: 0.7;
		}

		&--active {
			opacity: 1;
			box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 30%, transparent);
			animation: glow 1.6s ease-in-out infinite;
		}
	}

	// A cross, so "stopped here" reads without relying on colour alone.
	.dot--rejected {
		position: relative;
		opacity: 1;
		background: #fff;
		box-shadow: inset 0 0 0 1.5px #e5484d;

		&::before,
		&::after {
			content: '';
			position: absolute;
			left: 50%;
			top: 50%;
			width: 5px;
			height: 1.5px;
			background: #e5484d;
			transform: translate(-50%, -50%) rotate(45deg);
		}

		&::after {
			transform: translate(-50%, -50%) rotate(-45deg);
		}
	}

	@keyframes glow {
		50% {
			box-shadow:
				0 0 0 3px color-mix(in srgb, var(--c) 25%, transparent),
				0 0 10px 2px color-mix(in srgb, var(--c) 70%, transparent);
		}
	}
</style>
