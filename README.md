# IIT Guwahati Technology Incubation Centre

Website for **IIT Guwahati Technology Incubation Centre (IITG TIC)** — incubation, mentorship, infrastructure, and funding support for deep-tech startups.

Live: https://iitgtic.vercel.app

## Stack

- **SvelteKit 2** + **Svelte 5** (runes)
- **TypeScript**
- **Sass / SCSS**
- **Supabase** — Postgres, Auth, RLS, and Storage
- **GSAP** — page/section animations
- **Vercel** — hosting + analytics

## Getting started

This project uses **pnpm**.

```sh
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev
```

Open http://localhost:5173.

## Scripts

| Script         | What it does                         |
| -------------- | ------------------------------------ |
| `pnpm dev`     | Start the dev server                 |
| `pnpm build`   | Build for production                 |
| `pnpm preview` | Preview the production build locally |
| `pnpm check`   | Type-check with `svelte-check`       |
| `pnpm lint`    | Prettier + ESLint check              |
| `pnpm format`  | Format with Prettier                 |

## Supabase

Schema lives in `supabase/migrations/` and is applied with the Supabase CLI:

```sh
supabase link --project-ref <project-ref>
supabase db push
```

Six tables, all with RLS enabled:

| Table          | Holds                                                     | Who can read/write                                                       |
| -------------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| `profiles`     | One row per auth user (`founder`, `company` or `admin`)   | Own row; `role` is service-role only                                     |
| `companies`    | Job-portal accounts + verification status                 | Own row; `status` is service-role only                                   |
| `jobs`         | Company job postings                                      | Public read once the company is verified; write only by a verified owner |
| `applications` | Submitted incubation applications                         | Own rows; `status` is service-role only                                  |
| `audit_log`    | Every row change, with actor and before/after             | Service role only — RLS on, zero policies                                |
| `page_views`   | One row per page view, admin routes included              | Service role only — RLS on, zero policies                                |
| `site_content` | Editable copy for every public page                       | Service role only; read on the server, written from the console          |

Two things are deliberately outside RLS's reach:

- **Signup** — an `on_auth_user_created` trigger writes the `profiles` row (and the
  `companies` row when the signup metadata says `role: 'company'`), so the client never
  inserts either.
- **TIC team admin** — admins are Supabase Auth users whose profile carries `role: 'admin'`.
  They sign in with their own credentials; the server verifies the role and issues a signed
  httpOnly session cookie. Admin writes still go through `/api/tic-admin/*` with the
  service-role key, because RLS has no notion of "admin".

Application attachments go to the private `application-documents` storage bucket, one
folder per user. The admin review screen never exposes those objects publicly — it hands
out 10-minute signed URLs instead.

### Demo data

The admin screens are much easier to work on with something in them:

```sh
node scripts/demo-data.js seed    # two applications + one pending company
node scripts/demo-data.js clear   # removes exactly what seed created
```

Every account it creates uses the `@demo-tic.co` domain, and `clear` deletes only those.

### First run

The console starts with no admin. Visit `/tic-admin/login` and it offers a one-time setup
form: enter `TIC_ADMIN_PASSWORD` from the environment and it creates the first admin
account. From then on that password stops granting access, and further admins are created
from **Users → New admin**.

### Audit trail

`audit_log` is written by Postgres triggers rather than by the application, so a row changed
through the SQL editor or any other client is recorded just like a click in the console. The
acting user comes from `auth.uid()` for browser writes, and from an `x-actor-id` request
header for service-role writes — `requireAdmin()` in `$lib/server/adminGuard.ts` attaches
that header, which is why an admin action names the person rather than "service role".

Page views are written by `src/hooks.server.ts`, one row per HTML response to a GET, with
admin routes flagged and attributed to the signed-in admin. The console shows them as a card
per page — total impressions, unique human visitors and bot hits — from the
`page_impressions(since)` function, which separates crawlers out by user agent.

### Why the admin console is server-rendered

`/tic-admin/+layout.server.ts` reads the session cookie and redirects if it is missing, and
each section has a `+page.server.ts` that loads its data. Nothing in the console waits on a
client-side fetch before it can render, so moving between sections keeps the current screen
on show until the next one is ready instead of blanking. Mutations still go through the
audited `/api/tic-admin/*` routes and call `invalidateAll()` to re-run the load.

### Email confirmation

The project currently has **email confirmation enabled**, so `signUp` returns no session
and the sign-up screens tell the user to check their inbox. To let people in immediately
instead, turn off _Confirm email_ under **Authentication → Sign In / Providers → Email**
in the Supabase dashboard — the code already handles both cases.

## Project structure

```
src/
├── app.html                # Document shell + global SEO meta
├── lib/
│   ├── assets/             # Bundled assets (imported into components)
│   ├── components/         # Reusable UI components
│   ├── data/
│   │   └── content.json    # Content for static pages + dynamic [slug] routes
│   ├── server/             # Service-role client + admin session (never bundled)
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
│   ├── api/                # Turnstile, admin login, service-role admin routes
│   └── sitemap.xml/        # Dynamic sitemap endpoint
└── styles/
supabase/
└── migrations/             # Schema + RLS, applied with `supabase db push`
static/
├── banner-iitgtic.webp     # Open Graph share image
├── favicon.svg
└── robots.txt
```

## Content model

Every public page renders from the `site_content` table, edited at
**/tic-admin/content**. `src/lib/data/content.json` is still in the repo, but only as the
fallback: the root layout loads the stored sections, merges them over the bundled document,
and hands the result to every page through `getContent()` in `$lib/content`. A section that
has never been saved — or a database that cannot be reached — falls through to the JSON, so
the site cannot be taken down by a bad content deploy.

Seed the table once per environment:

```sh
node scripts/seed-content.js          # import sections not there yet
node scripts/seed-content.js --force  # overwrite every section from content.json
```

The editor is schema-driven rather than hand-written per page: it reads the shape of the
stored JSON and renders text inputs, textareas for long copy, checkboxes, and reorderable
lists with add and remove. Adding a page to `content.json` and re-running the seed makes it
editable without touching the admin code. Every save is audited with a before and after, and
each section has a **Reset to default copy** button.

The `value` column is `json` rather than `jsonb` on purpose — `jsonb` sorts object keys, which
reordered the fields in the editor (an FAQ showed its answer above its question).

Historically most pages rendered straight from `src/lib/data/content.json`. Dynamic routes (`events/[slug]`, `about/blog/[slug]`, `incubation/[slug]`, `incubated-startups/[slug]/[startupSlug]`, `opportunities/[id]`) look up entries by slug from the same file. Adding a new event/post means adding an entry — no new files needed.

Job postings are the union of the eight seed posts in `content.json` and live rows from
`public.jobs`, so the Opportunities page still renders if Supabase is unreachable.

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
