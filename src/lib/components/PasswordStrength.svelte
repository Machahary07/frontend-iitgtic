<script lang="ts">
	// A thin line under a "choose a password" field that runs edge to edge. It
	// fills from the left as the password gets stronger and shifts from red
	// through amber to green, with the verdict and one tip beneath it. Hidden
	// until something is typed.
	import { passwordStrength } from '$lib/utils/passwordStrength';

	let { password }: { password: string } = $props();

	const strength = $derived(passwordStrength(password));
	// Never quite empty once typing starts, so the line is always visible.
	const fill = $derived(((strength.score + 1) / 5) * 100);
	// 0 = red, 130 = green, through amber.
	const hue = $derived(Math.round((strength.score / 4) * 130));
</script>

{#if password}
	<div class="strength" style:--fill="{fill}%" style:--hue={hue}>
		<div
			class="strength__track"
			role="meter"
			aria-label="Password strength"
			aria-valuemin="0"
			aria-valuemax="4"
			aria-valuenow={strength.score}
			aria-valuetext={strength.label}
		>
			<div class="strength__bar"></div>
		</div>
		<p class="strength__text" aria-live="polite">
			<span class="strength__label">{strength.label}</span>
			{#if strength.tip}<span class="strength__tip">{strength.tip}</span>{/if}
		</p>
	</div>
{/if}

<style>
	.strength {
		width: 100%;
		margin-top: 8px;
	}

	.strength__track {
		width: 100%;
		height: 4px;
		overflow: hidden;
		background: rgba(17, 20, 24, 0.08);
		border-radius: 999px;
	}

	.strength__bar {
		width: var(--fill);
		height: 100%;
		background: hsl(var(--hue) 72% 42%);
		border-radius: inherit;
		transition:
			width 0.35s cubic-bezier(0.16, 1, 0.3, 1),
			background-color 0.35s ease;
	}

	.strength__text {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 2px 10px;
		margin: 6px 0 0;
		font-size: 12px;
		line-height: 1.4;
	}

	.strength__label {
		font-weight: 600;
		color: hsl(var(--hue) 72% 34%);
		transition: color 0.35s ease;
	}

	.strength__tip {
		color: #6b7079;
	}

	@media (prefers-reduced-motion: reduce) {
		.strength__bar,
		.strength__label {
			transition: none;
		}
	}
</style>
