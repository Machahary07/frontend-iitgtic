# IIT Guwahati TIC — Progress Report

**Project:** IIT Guwahati Technology Incubation Centre website & platform
**Scope of this report:** Everything built from the backend onward — the backend itself and every update made after it.
**Prepared:** 2026-09-01 · **Last updated:** 2026-09-04

> This document is a running log. Every update made after the backend went in — including the backend work itself — is recorded here. Newest work sits at the top of each section.

---

## 1. Executive summary 

The project moved from a static, front-end-only site to a full platform with a database, authentication, an admin console, transactional email, and analytics. The work breaks into four phases:

1. **Auth & bot defence** (Jul 2026) — server-side admin login and Cloudflare Turnstile on every public form.
2. **Backend foundation** (29 Aug 2026) — Supabase Postgres schema, Row Level Security, storage buckets, and the TIC admin console.
3. **Feature build-out** (29 Aug – 1 Sep 2026) — incubation applications, the company job portal, role applications, content editing, audit log, page analytics, and transactional email.
4. **Content & polish** (31 Aug – 1 Sep 2026) — real content pass, mobile panel redesign, and interaction refinements.

Overall delta since the backend began: **135 files changed, ~19,000 insertions, ~4,700 deletions.**

> **Current focus (2026-09-04):** **media is now editable from the console** — images uploadable through the content editor, not just their alt text. The `site-assets` bucket landed as migration `20260904000000_site_assets`, so the upload path is complete end to end and §3.9 is **done**. First surface is the Partners logos, which the home association marquee mirrors from the same list. What remains there is content, not plumbing: the `{ alt }`-only placeholders still need real pictures, and video is a separate bucket and player. The transactional email system remains **in progress** (auth confirmation email links to `localhost`; Resend domain unverified).

---

## 2. The backend (foundation)

The backend is built on **Supabase** (Postgres + Auth + Row Level Security + Storage), served through **SvelteKit 2** server routes on **Vercel**.

### 2.1 Auth & bot defence — 13 Jul 2026

- Cloudflare **Turnstile** widget component (`Turnstile.svelte`) added and wired into every public form: `apply`, `login`, job-posting signup, and TIC admin login.
- Turnstile secret verification kept **server-side** (`/api/turnstile`); every gated write re-verifies the token.
- TIC admin auth **refactored to server-side password verification** — no password logic in the browser.

### 2.2 Database schema & security — 29 Aug 2026

Postgres schema applied via Supabase migrations. **Ten tables, RLS enabled on every one:**

| Table | Holds |
| --- | --- |
| `profiles` | One row per auth user (founder / company / admin) |
| `companies` | Job-portal accounts + verification status |
| `jobs` | Company job postings |
| `applications` | Submitted incubation applications |
| `job_applications` | Applications to a role on the Opportunities board |
| `email_templates` | Subject + HTML body per message |
| `email_log` | One row per send attempt |
| `audit_log` | Every row change, with actor and before/after |
| `page_views` | One row per page view |
| `site_content` | Editable copy for every public page |

Migrations, in order:

- `20260829000000_init_tic_schema` — base schema + RLS
- `20260829010000_require_verified_company_to_post` — only verified companies can post jobs
- `20260829020000_application_review` — incubation application review flow
- `20260829030000_admins_audit_and_traffic` — admin roles, audit triggers, traffic capture
- `20260829040000_page_impressions` — `page_impressions()` function (bot separation by user agent)
- `20260829050000_site_content` + `20260829060000_..._preserve_key_order` — editable content store
- `20260831000000_job_applications` — role-application table + unique-per-email index
- `20260901000000_email`, `..._email_template_blocks`, `..._email_assets` — email system tables & assets bucket
- `20260904000000_site_assets` — public `site-assets` bucket for content-editor image uploads

### 2.3 Security model

- Browser only ever holds the **publishable key**; RLS governs everything it can read.
- **Service-role key** lives only in `src/lib/server` and `+server.ts` files — never bundled to the client.
- Writes RLS can't express go through guarded route handlers (`requireAdmin()` → service role, tagged with `x-actor-id` for audit attribution).
- **`on_auth_user_created` trigger** writes the `profiles` (and `companies`) row on signup.
- Admin session = signed, httpOnly cookie (8h), issued after verifying `profiles.role = 'admin'`.

### 2.4 Storage

| Bucket | Public? | Holds |
| --- | --- | --- |
| `application-documents` | No | Pitch deck, CV, financials, incorporation cert |
| `job-applications` | No | Resumes for role applications |
| `email-assets` | Yes | Images/files used inside emails |
| `site-assets` | Yes | Images uploaded for the public site from the content editor (see §3.9) |

Private buckets are never exposed directly — admin screens hand out **10-minute signed URLs**. Deleting a row deletes its objects first (no orphans).

### 2.5 API surface

Server routes added under `src/routes/api/`:

- `/api/turnstile` — verify a widget token
- `/api/job-applications` — **public** role application (Turnstile + resume upload + insert)
- `/api/company-account` — signup receipt / self-close account
- `/api/tic-admin-login` — session state, sign-in, first-admin bootstrap, sign-out
- `/api/tic-admin/companies` — verify / reject / delete
- `/api/tic-admin/applications` — move incubation applications through review
- `/api/tic-admin/job-applications` — shortlist / forward / decline / delete
- `/api/tic-admin/jobs` — take down a company-posted role
- `/api/tic-admin/users` — roles, suspend, reset mail, delete, create admin
- `/api/tic-admin/activity` — paged audit entries + impressions
- `/api/tic-admin/content` + `/api/tic-admin/content/assets` — save / reset a content section; upload an image for a media field (see §3.9)
- `/api/tic-admin/email` + `/api/tic-admin/email/assets` — log, templates, test send, asset upload

---

## 3. Features built after the backend

### 3.1 TIC admin console (`/tic-admin`) — 29–31 Aug 2026

Server-rendered admin dashboard (`tic-admin v1`–`v4`). Sections:

- **Overview** — stat tiles + queues needing attention
- **Companies** — verify, reject with reason, revert, delete
- **Applications** + detail — incubation review queue, full answers, signed document links
- **Job applications** + detail — role applicants, status tabs, per-role filter, signed resume link
- **Jobs** — every seed and company-posted role; take one down
- **Users** — role, last sign-in, suspend, password reset, delete, new admin
- **Activity** — audit log with before/after diffs + per-page impressions
- **Content** — schema-driven editor for every content section
- **Email** — usage meter, 30-day trend, delivery log with previews, template editor

Every mutation goes through the audited `/api/tic-admin/*` routes and calls `invalidateAll()`.

### 3.2 Incubation application (`/application`)

Eight-step wizard, 38 questions, four document uploads to the private `application-documents` bucket. Admin review queue at `/tic-admin/applications`.

### 3.3 Company job portal (`/opportunities/job-posting-admin`)

Company signs up → TIC verifies → company posts and edits roles. Gated by account status (pending / verified / rejected). Includes signup, role editor, and admin settings (profile, password change, delete account).

### 3.4 Role applications (`/opportunities/[id]`) — 31 Aug 2026

Public apply form per role — resume upload, Turnstile-gated, **no account needed**. Writes through `POST /api/job-applications`: re-verifies Turnstile, looks the role up server-side, uploads resume, inserts row. Second application from same email to same role returns "you have already applied" (unique index). Also added an **application status page**.

### 3.5 Content model

Every public page renders from the `site_content` table, edited at `/tic-admin/content`. `content.json` remains as the bundled fallback so a bad content deploy can't take the site down. Schema-driven editor; every save audited with before/after; per-section "Reset to default copy".

### 3.6 Transactional email — 1 Sep 2026 · **IN PROGRESS**

Resend-backed mail, visible at `/tic-admin/email`. The console and template machinery are built; the system is **not finished** — see the open issues below.

**Done:**

- **Triggers:** company signup received; company verified / not verified; application under review / accepted / declined; role application received; applicant shortlisted / forwarded / not taken forward.
- **Block-based template editor** (`tic-admin v4 email`) — messages composed from reorderable blocks (text, emphasis, media, spacing), compiled server-side by `renderBlocks()`; raw-HTML mode also available.
- **Delivery log** (`email_log`) with `sent` / `failed` / `blocked` outcomes and full rendered body preview.
- **Usage meter** counts `sent` rows against the plan (`RESEND_PLAN`), checked before each send.
- A send never fails the request — verification/submit completes even when mail is down.

**Still to do:**

- 🐞 **Confirmation/login email points at `localhost`.** The Supabase Auth confirmation email arrives with a `http://localhost:3000` (dev) link instead of the live site. This is the Supabase **Site URL / Redirect URLs** configuration (and/or the `emailRedirectTo` passed at `signUp`/sign-in) — needs to be set to the production origin so links resolve correctly. **Scheduled to fix today (2026-09-01).**
- **Domain not verified in Resend** — sending still runs from the sandbox sender; a verified domain is required before real mail goes out.
- **No webhooks** — bounces and complaints are not read back from Resend.

### 3.7 Analytics & audit

- **Page views** written by `src/hooks.server.ts` — one row per HTML GET, admin routes flagged and attributed.
- **`page_impressions()`** separates crawlers from humans by user agent.
- **Audit trail** written by Postgres triggers (not the app), so any row change is recorded; actor resolved from `auth.uid()` or the `x-actor-id` header.

### 3.8 Build status page (`/status`)

Self-hosted checklist of every route, component and backend piece, with a frontend and a backend rail. Updated across `dbc8e76`, `ac04233`.

### 3.9 Editable media — 3–4 Sep 2026 · **DONE (backend complete)**

Until now the content editor only made **text** editable; images were either baked into the bundle as a key (`"image": "iitGuwahati"`, resolved against `src/lib/data/images.ts`) or existed as `{ alt }`-only placeholders with no real source. The image itself is now uploadable from the console, end to end.

**Done (frontend):**

- **Media field in the content editor** — the recursive `ContentField.svelte` now renders a preview + **Upload image** button (and a paste-a-URL box) wherever a string field reads as an image (`image`, `logo`, `photo`, `avatar`, …), instead of a plain text input.
- **Upload route** `POST /api/tic-admin/content/assets` — admin-only, service-role; stores the file in the public `site-assets` bucket and returns its URL, which is saved into the section. Mirrors the existing email-asset uploader.
- **`resolveMedia()`** (`src/lib/media.ts`) — lets an uploaded URL and a legacy bundled key coexist, so content migrates gradually without anything breaking.
- **Partners ⇄ home marquee connected** — the home association marquee now mirrors `pages.partners.partners`, and the duplicate `homeHero.association.logos` list was removed. Editing the Partners section in the console is the single source of truth and updates both surfaces.

**Done (backend, 4 Sep 2026):**

- **The `site-assets` bucket now exists**, applied as migration `20260904000000_site_assets.sql` rather than a hand-run SQL statement, so it is reproducible on any environment via `supabase db push`. Public read, 5 MB cap, `image/png · jpeg · gif · webp · svg+xml` only, and **no write policies** — so the service-role upload route is the only way anything gets in. Same model as `email-assets`.
- **Verified end to end**, not just created: service-role upload succeeds; the returned public URL is readable with no credentials at all and comes back as `image/png`; an upload with the **publishable key is refused (400)**; a non-image MIME type is **refused (400)**; the test object was removed afterwards.
- **`pnpm doctor` now checks storage.** The schema could be perfect while an upload still fails, because a bucket that was never pushed lives outside the tables the doctor read. It now asserts all four buckets exist with the right public flag, so a missing bucket is a one-line diagnosis instead of a 500 in the console.

**Still to do — content and video, not plumbing:** the remaining `{ alt }`-only placeholders (events, incubation, startups, people photos) need real pictures uploaded, and video needs its own bucket and player.

---

## 4. Ops, tooling & deploy

- **`pnpm doctor`** — checks `.env.local` can reach Supabase, flags a publishable-for-secret key mix-up, reports admin/content counts, and asserts every storage bucket exists with the right public flag.
- **Seed scripts** — `scripts/seed-content.js` (import content sections) and `scripts/demo-data.js` (two applications + one pending company on `@demo-tic.co`).
- **First-run bootstrap** — `/tic-admin/login` offers one-time first-admin setup using `TIC_ADMIN_PASSWORD`; the console refuses to bootstrap while it can't read the admin table.
- **`vercel.json`** added; deploy via `@sveltejs/adapter-auto`, pushes to `main` auto-deploy.
- **Dev server header limit** — `pnpm dev` and `pnpm preview` run Vite through `node --max-http-header-size=65536`. Cookies are scoped to a host and ignore the port, so every project ever served from `localhost` shares one cookie jar; once it passes Node's 16 KB default the dev server answers every request with **HTTP 431** in that browser profile while incognito works fine. Raising the ceiling fixes it without asking anyone to clear cookies and sign out of their other local projects.
- **`.gitignore`** / `supabase/.gitignore` updated for the Supabase toolchain and env files.
- **Environment** — new server-only vars: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SESSION_SECRET`, `TIC_ADMIN_PASSWORD`, `TURNSTILE_SECRET_KEY`, `RESEND_*`, plus public `PUBLIC_TURNSTILE_SITE_KEY`.

---

## 5. Content & UI polish — 31 Aug – 1 Sep 2026

- **Real content pass** (`5e30e58`) — replacing placeholder copy across pages (in progress).
- **Mobile panel redesign** (`08db7af`) — enhanced mobile panel; removed the application-link section and its styles.
- **`ButtonReveal` loading state** (`d9735b4`) — added a loading state to the reveal button and updated all usages.

---

## 6. Known gaps / roadmap

Tracked live at `/status`. Open items:

| Area | Gap |
| --- | --- |
| Company-side applicant inbox | `job_applications` records `job_id`/`company_id`, but a verified company still can't read its own applicants |
| **Email system (in progress)** | Console + templates built, but: auth confirmation email links to `localhost` (fix today), Resend domain not verified, no bounce/complaint webhooks |
| Rate limiting | Turnstile + one-application-per-email is the only brake on the public submit route |
| Resume retention | Resumes stay in the bucket until an admin deletes the row — no expiry, no bulk export |
| Backups | Running on Supabase defaults; restore never rehearsed |
| Per-page SEO | Only `<title>` per page — descriptions, OG, canonicals are global |
| Prerender flags | Static pages still SSR |
| Real content | Partner logos, event/people photos, startup logos are placeholders |
| Editable media | **Backend complete** — `site-assets` bucket applied and verified, upload path works end to end (§3.9). Remaining work is content: events/incubation/startup placeholders need real pictures, and video needs its own bucket and player |
| Application drafts | A refresh loses progress on the eight-step form |

---

## 7. Commit trail (backend onward)

| Date | Commit | Summary |
| --- | --- | --- |
| 2026-09-04 | `402ba41` | tic-admin v7 — editable media **completed**: `20260904000000_site_assets` migration creates the public `site-assets` bucket, upload path verified end to end (anon writes and non-image types both refused), `pnpm doctor` gained a storage-bucket check, status page updated. Also raised the dev server's max HTTP header size to 64 KB so an accumulated `localhost` cookie jar stops returning 431 |
| 2026-09-03 | `b2884a1` | Editable media (frontend): media field in the content editor, `/api/tic-admin/content/assets` upload route, `resolveMedia()`, Partners⇄home-marquee connected; status page updated |
| 2026-09-01 | _(pending)_ | Mark email system as **in progress** on the status page; fix confirmation-email localhost link |
| 2026-07-13 | `a295b62` | Turnstile verification + server-side TIC admin auth |
| 2026-08-28 | `dbc8e76` | Updated status page |
| 2026-08-29 | `5de5424` | tic-admin v1 |
| 2026-08-30 | `f7fa514` | tic-admin v2 |
| 2026-08-30 | `57dbb92` / `337babd` | gitignore / vercel.json |
| 2026-08-30 | `1f9a852` / `e9deed5` | opportunities page + apply-for-role form card, status page |
| 2026-08-31 | `9f86a1d` | tic-admin v3 |
| 2026-08-31 | `a40f608` | tic-admin v4 email (block-based email templates) |
| 2026-08-31 | `5e30e58` | Real content (in progress) |
| 2026-08-31 | `08db7af` | Remove application-link section; enhance mobile panel |
| 2026-09-01 | `d9735b4` | ButtonReveal loading state + usages |

_Migration timestamps span `20260829` → `20260904`; several were merged through PRs #1–#3 on `feature/tic-admin`._

---

<sub>IIT Guwahati Technology Incubation Centre · iitgtic.vercel.app</sub>
