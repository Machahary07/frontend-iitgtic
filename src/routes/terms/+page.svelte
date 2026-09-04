<script lang="ts">
	import LegalPage from '$lib/components/LegalPage.svelte';
	import { getContent } from '$lib/content';

	const page = getContent().pages.terms;
</script>

<LegalPage {page} />
