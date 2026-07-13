import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		cssMinify: 'lightningcss',
		cssCodeSplit: true,
		assetsInlineLimit: 4096
	},
	css: {
		devSourcemap: true
	}
});
