<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { liveRefresh } from '$lib/utils/liveRefresh';

	let { children }: { children: Snippet } = $props();

	// Keeps the founder console current without a reload — a startup verified by
	// TIC, a new applicant — see liveRefresh.
	onMount(() => liveRefresh());
</script>

{@render children()}
