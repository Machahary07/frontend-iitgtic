<script lang="ts" module>
	declare global {
		interface Window {
			turnstile?: {
				render: (el: HTMLElement, opts: Record<string, unknown>) => string;
				reset: (id: string) => void;
			};
		}
	}

	let scriptPromise: Promise<void> | null = null;

	function loadScript(): Promise<void> {
		if (!scriptPromise) {
			scriptPromise = new Promise((resolve) => {
				if (window.turnstile) {
					resolve();
					return;
				}
				const s = document.createElement('script');
				s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
				s.async = true;
				s.onload = () => resolve();
				document.head.appendChild(s);
			});
		}
		return scriptPromise;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { PUBLIC_TURNSTILE_SITE_KEY } from '$env/static/public';

	let { token = $bindable('') }: { token?: string } = $props();

	let container: HTMLDivElement;
	let widgetId: string | undefined;

	onMount(() => {
		let cancelled = false;
		loadScript().then(() => {
			if (cancelled || !window.turnstile) return;
			widgetId = window.turnstile.render(container, {
				sitekey: PUBLIC_TURNSTILE_SITE_KEY,
				callback: (t: string) => (token = t),
				'expired-callback': () => (token = ''),
				'error-callback': () => (token = '')
			});
		});
		return () => {
			cancelled = true;
		};
	});

	// Tokens are single-use: call this after every verification attempt.
	export function reset() {
		token = '';
		if (widgetId !== undefined && window.turnstile) window.turnstile.reset(widgetId);
	}
</script>

<div bind:this={container}></div>
