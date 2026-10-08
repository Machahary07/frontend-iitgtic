// Renders the admin manual to docs/IITG-TIC-Admin-Manual.pdf.
// Playwright is not a project dependency. To rebuild:
//   pnpm add -D playwright && pnpm exec playwright install chromium
//   node scripts/manual/build-pdf.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve(here, 'admin-manual.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({
	path: resolve(here, '../../docs/IITG-TIC-Admin-Manual.pdf'),
	format: 'A4',
	printBackground: true,
	preferCSSPageSize: true
});
await browser.close();
console.log('docs/IITG-TIC-Admin-Manual.pdf written');
