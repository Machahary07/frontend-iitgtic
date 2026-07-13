<script lang="ts">
	interface Props {
		name: 'linkedin' | 'twitter' | 'instagram' | 'facebook' | 'github' | 'youtube';
		size?: number;
		strokeWidth?: number;
		title?: string;
	}

	let { name, size = 16, strokeWidth = 1.75, title }: Props = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden={title ? undefined : true}
	role={title ? 'img' : undefined}
>
	{#if title}<title>{title}</title>{/if}

	{#if name === 'linkedin'}
		<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
		<rect width="4" height="12" x="2" y="9" />
		<circle cx="4" cy="4" r="2" />
	{:else if name === 'twitter'}
		<path d="M4 4l7.5 10.2L4.5 20H7l5.6-6.4L17 20h3l-7.9-10.7L19.5 4H17l-5.1 5.9L7 4z" fill="currentColor" stroke="none" />
		<path d="M4 4l7.5 10.2L4.5 20H7l5.6-6.4L17 20h3l-7.9-10.7L19.5 4H17l-5.1 5.9L7 4z" />
	{:else if name === 'instagram'}
		<rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
		<path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
		<line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
	{:else if name === 'facebook'}
		<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
	{:else if name === 'github'}
		<path
			d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
		<path d="M9 18c-4.51 2-5-2-7-2" />
	{:else if name === 'youtube'}
		<path
			d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
		<path d="m10 15 5-3-5-3z" />
	{/if}
</svg>
