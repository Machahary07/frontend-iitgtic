# IIT Guwahati Technology Incubation Centre

Website for **IIT Guwahati Technology Incubation Centre (IITG TIC)** — incubation, mentorship, infrastructure, and funding support for deep-tech startups.

Live: https://iitgtic.vercel.app

## Stack

- **SvelteKit 2** + **Svelte 5** (runes)
- **TypeScript**
- **Sass / SCSS**
- **Supabase** — auth + job postings backend
- **GSAP** — page/section animations
- **Vercel** — hosting + analytics

## Getting started

```sh
npm install
npm run dev
```

Open http://localhost:5173.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |
| `npm run check` | Type-check with `svelte-check` |
| `npm run lint` | Prettier + ESLint check |
| `npm run format` | Format with Prettier |

## Project structure

```
src/
├── app.html                # Document shell + global SEO meta
├── lib/
│   ├── assets/             # Bundled assets (imported into components)
│   ├── components/         # Reusable UI components
│   ├── data/
│   │   └── content.json    # Content for static pages + dynamic [slug] routes
│   └── utils/
├── routes/
│   ├── +layout.svelte
│   ├── +page.svelte        # Home
│   ├── about/              # About, team, mentors, blog, FAQ, governing body
│   ├── events/             # Events index + [slug] detail
│   ├── incubation/         # Incubation pillars + [slug] detail
│   ├── incubated-startups/ # Categories + [slug]/[startupSlug]
│   ├── opportunities/      # Job postings (seed + Supabase)
│   ├── partners/
│   ├── tic-admin/          # Admin dashboard (protected, noindex)
│   └── sitemap.xml/        # Dynamic sitemap endpoint
└── styles/
static/
├── banner-iitgtic.webp     # Open Graph share image
├── favicon.svg
└── robots.txt
```

## Content model

Most public pages render from `src/lib/data/content.json`. Dynamic routes (`events/[slug]`, `about/blog/[slug]`, `incubation/[slug]`, `incubated-startups/[slug]/[startupSlug]`, `opportunities/[id]`) look up entries by slug from the same file. Adding a new event/post means adding an entry — no new files needed.

Job postings additionally pull live records from Supabase via the `tic-admin` and `opportunities/job-posting-admin` flows.

## SEO

- **Global meta** — title, description, keywords, OG, Twitter card, canonical, and Organization JSON-LD live in `src/app.html`.
- **Open Graph image** — `static/banner-iitgtic.webp` is served at `/banner-iitgtic.webp` for social previews.
- **Sitemap** — `src/routes/sitemap.xml/+server.ts` generates `/sitemap.xml` from the static route list + `content.json` slugs.
- **robots.txt** — `static/robots.txt` allows public pages, disallows admin/auth routes, and links the sitemap.

After deploy, re-scrape social previews:
- Facebook/WhatsApp: https://developers.facebook.com/tools/debug/
- Twitter/X: https://cards-dev.twitter.com/validator
- LinkedIn: https://www.linkedin.com/post-inspector/

Submit `https://iitgtic.vercel.app/sitemap.xml` to:
- Google Search Console: https://search.google.com/search-console
- Bing Webmaster Tools: https://www.bing.com/webmasters

## Deploy

Deployed to Vercel via `@sveltejs/adapter-auto`. Pushes to `main` deploy automatically.
