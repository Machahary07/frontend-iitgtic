import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'base-uri': ['self'],
				'object-src': ['none'],
				'frame-ancestors': ['none'],
				'form-action': ['self'],
				'script-src': ['self', 'https://challenges.cloudflare.com', 'https://va.vercel-scripts.com'],
				'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
				'font-src': ['self', 'https://fonts.gstatic.com', 'data:'],
				'img-src': ['self', 'https:', 'data:', 'blob:'],
				'connect-src': ['self', 'https://*.supabase.co', 'wss://*.supabase.co', 'https://challenges.cloudflare.com', 'https://vitals.vercel-insights.com'],
				'frame-src': ['self', 'https://challenges.cloudflare.com', 'https://www.google.com'],
				'media-src': ['self', 'https:', 'blob:'],
				'worker-src': ['self', 'blob:']
			}
		},
		alias: {
			$styles: 'src/lib/styles'
		}
	}
};

export default config;
