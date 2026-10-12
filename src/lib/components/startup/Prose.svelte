<script lang="ts">
	// Founders write in full paragraphs. A blank line starts a new paragraph and a
	// single line break is kept, so the page reads the way they wrote it.
	interface Props {
		text: string;
		class?: string;
	}
	let { text, class: className = '' }: Props = $props();
	const paragraphs = $derived(
		text
			.split(/\n\s*\n/)
			.map((p) => p.trim())
			.filter(Boolean)
	);
</script>

{#each paragraphs as paragraph, i (i)}
	<p class={className} style:white-space="pre-line">{paragraph}</p>
{/each}
