# IIT Guwahati TIC — Progress Report

**Project:** IIT Guwahati Technology Incubation Centre website & platform
**Scope of this report:** Everything built from the backend onward — the backend itself and every update made after it.
**Prepared:** 2026-09-01

> This document is a running log. Every update made after the backend went in — including the backend work itself — is recorded here. Newest work sits at the top of each section.

---

## 1. Executive summary

The project moved from a static, front-end-only site to a full platform with a database, authentication, an admin console, transactional email, and analytics. The work breaks into four phases:

1. **Auth & bot defence** (Jul 2026) — server-side admin login and Cloudflare Turnstile on every public form.
2. **Backend foundation** (29 Aug 2026) — Supabase Postgres schema, Row Level Security, storage buckets, and the TIC admin console.
3. **Feature build-out** (29 Aug – 1 Sep 2026) — incubation applications, the company job portal, role applications, content editing, audit log, page analytics, and transactional email.
4. **Content & polish** (31 Aug – 1 Sep 2026) — real content pass, mobile panel redesign, and interaction refinements.

Overall delta since the backend began: **135 files changed, ~19,000 insertions, ~4,700 deletions.**

> **Current focus (2026-09-01):** the backlog of backend work in §6 has been closed out — company applicant inbox, rate limiting, resume export and retention, and delivery feedback — along with the `localhost` confirmation link and four bugs found while reading the code (§3.9). The one item that is **not** code remains open: the Resend sending domain is still unverified, so mail reaches only the account owner. The status page shows email as _in progress_ for that reason alone.

---

## 2. The backend (foundation)

The backend is built on **Supabase** (Postgres + Auth + Row Level Security + Storage), served through **SvelteKit 2** server routes on **Vercel**.

### 2.1 Auth & bot defence — 13 Jul 2026

- Cloudflare **Turnstile** widget component (`Turnstile.svelte`) added and wired into every public form: `apply`, `login`, job-posting signup, and TIC admin login.
- Turnstile secret verification kept **server-side** (`/api/turnstile`); every gated write re-verifies the token.
- TIC admin auth **refactored to server-side password verification** — no password logic in the browser.

### 2.2 Database schema & security — 29 Aug 2026

Postgres schema applied via Supabase migrations. **Ten tables, RLS enabled on every one:**

| Table                    | Holds                                                         |
| ------------------------ | ------------------------------------------------------------- |
| `profiles`               | One row per auth user (founder / company / admin)             |
| `companies`              | Job-portal accounts + verification status                     |
| `jobs`                   | Company job postings                                          |
| `applications`           | Submitted incubation applications                             |
| `job_applications`       | Applications to a role on the Opportunities board             |
| `email_templates`        | Subject + HTML body per message                               |
| `email_log`              | One row per send attempt                                      |
| `audit_log`              | Every row change, with actor and before/after                 |
| `page_views`             | One row per page view                                         |
| `site_content`           | Editable copy for every public page                           |
| `rate_limits`            | Fixed-window request counters for the public write routes     |
| `email_events`           | Delivery feedback from Resend — what happened after a send    |
| `email_suppressions`     | Addresses that hard-bounced or complained; never mailed again |
| `newsletter_subscribers` | Footer signups, one row per address                           |

Migrations, in order:

- `20260829000000_init_tic_schema` — base schema + RLS
- `20260829010000_require_verified_company_to_post` — only verified companies can post jobs
- `20260829020000_application_review` — incubation application review flow
- `20260829030000_admins_audit_and_traffic` — admin roles, audit triggers, traffic capture
- `20260829040000_page_impressions` — `page_impressions()` function (bot separation by user agent)
- `20260829050000_site_content` + `20260829060000_..._preserve_key_order` — editable content store
- `20260831000000_job_applications` — role-application table + unique-per-email index
- `20260901000000_email`, `..._email_template_blocks`, `..._email_assets` — email system tables & assets bucket
- `20260901030000_company_inbox_limits_and_delivery` — company applicant policy + column grant, resume storage policy, `rate_limits`, `email_events`, `email_suppressions`, and the missing owner-delete policy on the application bucket
- `20260901040000_newsletter_subscribers` — somewhere for the footer form to write

> **Ten tables became fourteen.** Neither of the two migrations above has been pushed yet — see §8.

### 2.3 Security model

- Browser only ever holds the **publishable key**; RLS governs everything it can read.
- **Service-role key** lives only in `src/lib/server` and `+server.ts` files — never bundled to the client.
- Writes RLS can't express go through guarded route handlers (`requireAdmin()` → service role, tagged with `x-actor-id` for audit attribution).
- **`on_auth_user_created` trigger** writes the `profiles` (and `companies`) row on signup.
- Admin session = signed, httpOnly cookie (8h), issued after verifying `profiles.role = 'admin'`.

### 2.4 Storage

| Bucket                  | Public? | Holds                                          |
| ----------------------- | ------- | ---------------------------------------------- |
| `application-documents` | No      | Pitch deck, CV, financials, incorporation cert |
| `job-applications`      | No      | Resumes for role applications                  |
| `email-assets`          | Yes     | Images/files used inside emails                |

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
- `/api/tic-admin/content` — save / reset a content section
- `/api/tic-admin/email` + `/api/tic-admin/email/assets` — log, templates, test send, asset upload
- `/api/tic-admin/email/suppressions` — lift a bounce or complaint suppression
- `/api/resend-webhook` — **public but signed**; delivery feedback from Resend

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
- ✅ **Auth links resolve to the live site** (fixed 2026-09-01) — see below.

**Fixed 2026-09-01 — the `localhost` confirmation link:**

The confirmation mail is sent by Supabase Auth, not by the Resend layer, so it never passed through `sendTemplateEmail()`. Neither `signUp()` call gave Supabase an `emailRedirectTo`, and with nothing to redirect to Supabase falls back to the project's **Site URL** — still the dashboard default `http://localhost:3000`. The address bar then showed `#access_token=…` because supabase-js runs the **implicit** flow by default: the link worked, the session was minted, and it was handed to an origin with nothing listening on it.

Three changes:

- `src/lib/utils/authRedirect.ts` — one place that builds the callback URL from the origin the person is actually on (`PUBLIC_SITE_URL` when there is no window), plus `safeNext()`, which keeps `?next=` to a path on this site so the callback can't be turned into an open redirect.
- `signupCompany()` and `signUpFounder()` now pass `emailRedirectTo`, pointing at `/auth/callback?next=…` — the company dashboard and the application form respectively.
- `src/routes/auth/callback/` — a client-only page (`ssr = false`; the fragment never reaches the server) that handles both link shapes: the implicit `#access_token=…`, which supabase-js consumes and strips on its own, and a PKCE `?code=`, which it exchanges. It then forwards to `next`, and explains itself when a link is expired, already used, or opened in a different browser to the one that signed up.

**Configuration this depends on** — Supabase Dashboard → Authentication → URL Configuration. Without it Supabase drops an unlisted `emailRedirectTo` silently and uses the Site URL anyway:

| Setting       | Value                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site URL      | `https://frontend-iitgtic.vercel.app` — where the app is actually served                                                                                |
| Redirect URLs | `https://frontend-iitgtic.vercel.app/**`, `https://*.vercel.app/**`, `https://iitgtic.com/**`, `https://www.iitgtic.com/**`, `http://localhost:5173/**` |

These are now recorded in `supabase/config.toml` so they are version-controlled rather than living only in a dashboard. `supabase config push` applies them — note it pushes the _whole_ config file, not just these two keys.

`supabase/config.toml` was corrected to match for local development (it still pointed at `127.0.0.1:3000`, while the dev server runs on `5173`).

**Delivery feedback — added 2026-09-01.**

`email_log` records what we handed to Resend. It cannot know what happened next: a hard bounce or a spam complaint arrives later, as a webhook, and without it the console shows a message as `sent` that never reached anyone. Continuing to mail those addresses is also what gets a sending domain blocked.

- `POST /api/resend-webhook` verifies Resend's Svix signature — HMAC-SHA256 over `` `${svix-id}.${svix-timestamp}.${raw body}` `` against the base64-decoded `whsec_` secret, with a five-minute timestamp tolerance so a captured request is not replayable, and support for the multiple `v1,` signatures sent during a key rotation. Implemented directly rather than by adding the `svix` package, matching the send path, which calls Resend's REST API with `fetch`.
- Verified **before** the body is parsed. With no `RESEND_WEBHOOK_SECRET` set the endpoint refuses everything: an unauthenticated version would let anyone suppress any address, which is a denial of service on your own mail.
- Events land in `email_events`, deduplicated on `(provider_id, type, occurred_at)` because Resend retries anything that did not answer 2xx. A failure to record answers 500 so the retry happens — losing a bounce silently is how a suppression list goes stale.
- A **permanent** bounce or any complaint writes `email_suppressions`, which `sendTemplateEmail()` checks before every non-test send. Transient bounces (a full mailbox, a temporary server failure) do not suppress. Test sends are exempt, because checking whether an address works again is a reason to send one.
- The console lists suppressed addresses beside the meter and can lift one — a mailbox that was full gets emptied — through `DELETE /api/tic-admin/email/suppressions`, audited like every other admin action.

**Password reset — fixed 2026-09-01.**

`resetPasswordForEmail()` redirected to `/login`, which received a `type=recovery` token in the fragment and ignored it, so the reset silently did nothing. It goes through `/auth/callback` now, which forwards to a new `/auth/reset-password` form. The callback reads the link's `type` so a recovery link no longer says "confirming your email". The **Forgot password?** link on `/login` was an anchor back to `/login` — a dead control — and now sends the mail, reporting success whether or not the address is registered so the form cannot be used to test who has an account.

**Still to do:**

- **Domain not verified in Resend** — sending still runs from the sandbox sender, which only reaches the account owner; a verified domain is required before real mail goes out. This is a DNS change, not a code change, and it is the only thing keeping the email system marked _in progress_.

### 3.7 Company applicant inbox — 1 Sep 2026

`job_applications` had RLS on with no policies since it was created, so every read went through the TIC console's service role and a company could not see who had applied to its own roles.

- A select policy opens the table to the company named in `company_id`, and only while `is_company_verified()` holds — a rejected account loses the inbox the same way it loses the ability to post.
- A **column-level** grant excludes `review_note` and `reviewed_at`: those are TIC's internal notes on a candidate. A column grant also means `select *` is rejected outright for the authenticated role, so a column added later cannot leak by default.
- There is no write path. The company has a select grant and nothing else, so a status stays TIC's to set.
- Resumes live in a private bucket at `<job-slug>/<file>`, so a storage policy resolves the first folder segment back to its owner through `company_owns_job_slug()`. The company signs its own 10-minute URLs; the objects are never public.
- The screen at `/opportunities/job-posting-admin/applicants` has status tabs, a per-role filter, expandable detail and a CSV export. The three portal pages each carried their own copy of the sidebar list, so it moved to `companyNav.ts` — otherwise a new section means editing three files and the one you forget loses its nav.

### 3.8 Rate limiting & retention — 1 Sep 2026

**Rate limiting.** Turnstile plus one-application-per-email was the only brake on the public write routes, and the admin login had none at all. The counters are Postgres rows rather than a module-level `Map`, because the app is serverless: an in-memory counter is per-instance, resets on every cold start, and is defeated by fanning requests across instances. `rate_limit_hit()` does insert-or-increment in one atomic statement, so two concurrent requests cannot both read a stale count.

| Route                        | Window | Max       |
| ---------------------------- | ------ | --------- |
| `POST /api/job-applications` | 1 hour | 10 per IP |
| `POST /api/company-account`  | 1 hour | 10 per IP |
| `POST /api/turnstile`        | 10 min | 30 per IP |
| `POST /api/tic-admin-login`  | 15 min | 10 per IP |

A limiter that cannot reach the database **allows** the request: locking people out of an application form because a counter is unavailable is worse than briefly failing open on a route that has other defences. Old windows are swept opportunistically, so this needs no `pg_cron`.

**Retention.** Deliberately no scheduled purge — deleting people's personal documents on a timer is the kind of thing only noticed once it has already run. Instead:

- CSV export on both sides. The TIC export pulls full records from `GET /api/tic-admin/job-applications`; the page loader keeps rendering a summary, because shipping every free-text answer into the HTML of a list view is waste.
- `POST /api/tic-admin/job-applications?jobSlug=…` clears a whole role, resumes first — once the rows are gone nothing records where the objects are. Confirmed in the UI, audited, and offered only when a single role is selected.
- CSV cells are guarded against formula injection: a value starting with `=`, `+`, `-` or `@` is executed by Excel and Sheets, so an applicant who types `=HYPERLINK(...)` into a form field would otherwise have it run on the reviewer's machine.

### 3.9 Bugs found and fixed — 1 Sep 2026

Found while reading the backend end to end, not reported by anyone:

| Where                                                            | What was wrong                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/company-account`                                      | Looked the address up with `.ilike()`, and PostgREST passes an `ilike` value through as a **LIKE pattern** — so `%` or `_` in the request body matched an account the caller did not own and posted it a signup receipt. Now `.eq()` on the lowercased address, which is the form Supabase Auth stores.                                                                                                                                                     |
| `DELETE /api/tic-admin/users`, `DELETE /api/tic-admin/companies` | Deleting an auth user cascades through the tables but **a cascade knows nothing about storage**. Every deleted founder left their pitch deck and CV in the private bucket forever, with no row left to find them by. Both routes now clear the user's folder before the cascade. Resumes are deliberately left alone — `job_applications.company_id` is `on delete set null`, so applications outlive the company and the console still needs to open them. |
| `POST /api/tic-admin-login`                                      | The bootstrap password was compared with `!==`, which returns as soon as a character differs and leaks the length and matching prefix of a shared secret. Now compared through a SHA-256 digest so the buffers are always equal length, and the route is rate limited.                                                                                                                                                                                      |
| `application-documents` bucket                                   | Had read, upload and replace policies for the owner but **no delete**, so an applicant who attached the wrong file could overwrite it but never remove it.                                                                                                                                                                                                                                                                                                  |
| `/login`                                                         | "Forgot password?" was an anchor pointing back at `/login` — a control that looked live and did nothing.                                                                                                                                                                                                                                                                                                                                                    |
| `sendTemplateEmail()`                                            | The one failure path that returned without writing an `email_log` row was a call with no recipient — the case most worth seeing in the console, since it only happens when a caller is buggy.                                                                                                                                                                                                                                                               |

### 3.10 Search, social, drafts & the newsletter — 1 Sep 2026

The remaining items on the `/status` checklist, closed out.

**Per-page metadata.** `app.html` already carried a description, canonical, Open Graph and Twitter block — but hardcoded, identical on every page. That was worse than having none:

- Two `<title>` tags on every page, the static one first, so **every server-rendered page and every crawler saw the homepage title** and the 37 real ones were dead. The per-page title only appeared after a client-side navigation, which is why it looked correct while browsing.
- One `<link rel="canonical">` pointing every page at `https://iitgtic.vercel.app` — an instruction to Google to treat all 37 pages as duplicates of the homepage.

`app.html` now keeps only what is genuinely invariant (keywords, author, `og:site_name`, `og:locale`, the Organization JSON-LD). Everything per-page comes from one `Seo.svelte` in the root layout. Descriptions are not new copy — they are read from each section's own `hero.lede` or `hero.intro`, so a page edited in the content console updates its own search snippet. Consoles, `/auth`, `/login` and `/application` are `noindex, nofollow`. An editable `seo` section was added for the site name and the fallback description.

**Application drafts.** The eight-step, ~40-question form lost everything on a refresh — the row in `public.applications` is only written on submit. It now autosaves to `localStorage`, keyed per account so a shared machine keeps two founders apart, and restores the step, the completed steps and the answers, with a notice saying when it was saved and a way to start over. Deliberately excluded: the four uploads (a `File` cannot be serialised, and no browser will re-read one without the user picking it again) and the three consent boxes (consent restored from storage was never actually given). Kept out of the database on purpose: it is one person's unfinished writing, changing on every keystroke, that nobody else ever reads.

**The newsletter form.** It called `preventDefault()` and then displayed "Thanks — we'll be in touch." Nothing was stored and nobody was ever in touch, so the message was simply untrue. It posts to `/api/newsletter` now — rate limited, validated, writing to a new `newsletter_subscribers` table — and only thanks you once the row exists. A repeat address is a plain success rather than an error, so the form cannot be used to find out who is already subscribed. The console shows the count and exports the list; a removal request deletes the row and is audited.

**Avatars.** Every person and mentorship track now carries an `avatar { src, alt }`, editable in the content console like any other field (the editor recurses into nested objects, so this needed no editor work). A card renders the photograph when there is one and keeps the plain circle when there is not, so the pages work as they are and improve the moment real photographs land.

**Prerendering — decided against, not deferred.** The checklist asked for `export const prerender = true` on the static pages. It should not be done: the root layout loads every page's copy from `site_content`, so a prerendered page freezes its text at build time and the content editor silently stops working on it; a prerendered route is also served without touching `hooks.server.ts`, so `page_views` would go dark exactly where traffic matters most. SSR with the in-process content cache already makes these pages a map lookup. The item is recorded as _won't do_ with that reasoning, and the checklist grew a fourth state so a deliberate decision no longer reads as an outstanding gap.

### 3.11 Analytics & audit

- **Page views** written by `src/hooks.server.ts` — one row per HTML GET, admin routes flagged and attributed.
- **`page_impressions()`** separates crawlers from humans by user agent.
- **Audit trail** written by Postgres triggers (not the app), so any row change is recorded; actor resolved from `auth.uid()` or the `x-actor-id` header.

### 3.12 Build status page (`/status`)

Self-hosted checklist of every route, component and backend piece, with a frontend and a backend rail. Updated across `dbc8e76`, `ac04233`.

---

## 4. Ops, tooling & deploy

- **`pnpm doctor`** — checks `.env.local` can reach Supabase, flags a publishable-for-secret key mix-up, reports admin/content counts.
- **Seed scripts** — `scripts/seed-content.js` (import content sections) and `scripts/demo-data.js` (two applications + one pending company on `@demo-tic.co`).
- **First-run bootstrap** — `/tic-admin/login` offers one-time first-admin setup using `TIC_ADMIN_PASSWORD`; the console refuses to bootstrap while it can't read the admin table.
- **`vercel.json`** added; deploy via `@sveltejs/adapter-auto`, pushes to `main` auto-deploy.
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

| Area                            | Gap                                                                                                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Email domain**                | Resend is still on the sandbox sender, which delivers only to the account owner. A DNS change, not a code change — and the only reason email is still marked _in progress_ |
| Backups                         | Running on Supabase defaults; restore never rehearsed                                                                                                                      |
| Company applicant notifications | A company sees its applicants but is not told when a new one arrives; the inbox is pull-only                                                                               |
| Real content                    | Partner logos, event and people photographs, startup logos are still placeholders. The `avatar` fields and the content console are ready for them; the pictures are not    |
| Per-page SEO                    | Only `<title>` per page — descriptions, OG, canonicals are global                                                                                                          |
| Prerender flags                 | Static pages still SSR                                                                                                                                                     |
| Real content                    | Partner logos, event/people photos, startup logos are placeholders                                                                                                         |
| Application drafts              | A refresh loses progress on the eight-step form                                                                                                                            |

---

## 7. Commit trail (backend onward)

| Date       | Commit                | Summary                                                                                                                               |
| ---------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-01 | `de96647`             | Mark the email system as **in progress** on the status page                                                                           |
| 2026-09-01 | _(working tree)_      | Auth callback route + `emailRedirectTo` — confirmation links resolve to the live origin                                               |
| 2026-09-01 | _(working tree)_      | Company applicant inbox, rate limiting, resume export + retention, Resend delivery webhook, password reset, and the six fixes in §3.9 |
| 2026-07-13 | `a295b62`             | Turnstile verification + server-side TIC admin auth                                                                                   |
| 2026-08-28 | `dbc8e76`             | Updated status page                                                                                                                   |
| 2026-08-29 | `5de5424`             | tic-admin v1                                                                                                                          |
| 2026-08-30 | `f7fa514`             | tic-admin v2                                                                                                                          |
| 2026-08-30 | `57dbb92` / `337babd` | gitignore / vercel.json                                                                                                               |
| 2026-08-30 | `1f9a852` / `e9deed5` | opportunities page + apply-for-role form card, status page                                                                            |
| 2026-08-31 | `9f86a1d`             | tic-admin v3                                                                                                                          |
| 2026-08-31 | `a40f608`             | tic-admin v4 email (block-based email templates)                                                                                      |
| 2026-08-31 | `5e30e58`             | Real content (in progress)                                                                                                            |
| 2026-08-31 | `08db7af`             | Remove application-link section; enhance mobile panel                                                                                 |
| 2026-09-01 | `d9735b4`             | ButtonReveal loading state + usages                                                                                                   |

_Migration timestamps span `20260829` → `20260901`; several were merged through PRs #1–#3 on `feature/tic-admin`._

---

## 8. What has to be done outside the code

The largest item on this list — pushing the two migrations — was closed on 2026-09-01, so the features that were inert against a schema that did not have them are now live and verified. What remains genuinely cannot be done from the repository: it needs a dashboard, a DNS record, or a project to throw away.

**Verified 2026-09-01 by probing the live project**, rather than assumed:

- The redirect allow-list is _not_ wide open — an unrelated origin was correctly rejected. But only `localhost` is accepted (Supabase always permits it), which means the Site URL is still the dashboard default and **a confirmation link from the deployed site still points at localhost**. The code fix works in dev today; production needs the table below.
- **The domain is `iitgtic.com`, not `iitgtic.in`.** An earlier pass in this report recorded `.in`, which resolves to nothing — hence the previous conclusion that "the domain does not exist". Corrected by direct lookup: `iitgtic.com` answers on A `108.167.146.149`, serves a 200, and carries Google Workspace MX records, so `@iitgtic.com` addresses are valid for signup. It is currently the _previous_ site, on shared hosting rather than Vercel; the new site lives at `frontend-iitgtic.vercel.app` until the cutover. Verifying it as a Resend sending domain therefore is not blocked on the domain existing — it is blocked on DNS access, which the team does not have yet.
- **The Resend key in `.env.local` is send-only.** `GET /domains` answers `401 restricted_api_key`. The earlier reading of "no domains registered at all" was this restriction, not an empty account — the key cannot see the list either way. The domain check in `pnpm doctor` and in the email console needs a full-access key to report anything.

| Step                                              | Where                                          | Why it matters                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~**Push the migrations**~~ — **done 2026-09-01** | Supabase CLI                                   | Both applied to `vbgldorzvhuippjmqiwq` and verified against the live project: the limiter refuses the 16th write in an hour and returns a retry-after, a forged / stale / tampered webhook payload is rejected and a real bounce writes a suppression, the newsletter stores rows and dedupes on `23505`, and none of the four new tables is readable by an anonymous client. |
| **Auth URL configuration**                        | Dashboard → Authentication → URL Configuration | Site URL `https://frontend-iitgtic.vercel.app`; redirect URLs as in the table above. An `emailRedirectTo` that is not allow-listed is dropped silently and the Site URL used instead. Recorded in `supabase/config.toml`; still needs applying.                                                                                                                               |
| **`RESEND_WEBHOOK_SECRET`**                       | Resend → Webhooks, then Vercel env             | Add an endpoint at `https://<site>/api/resend-webhook` subscribed to `email.bounced` and `email.complained`, and put the `whsec_…` secret in the environment. Without it the endpoint refuses everything, by design.                                                                                                                                                          |
| **`PUBLIC_SITE_URL`**                             | Vercel env                                     | Currently `http://localhost:5173` in `.env.local`. Every link inside a template email is built from it, so production mail would otherwise ship localhost links.                                                                                                                                                                                                              |
| **DNS access for `iitgtic.com`**                  | Whoever holds the registrar / DNS account      | The domain exists and is live; the records are simply not ours to edit yet. Publishing Resend's DKIM and SPF is the only thing standing between the current sandbox sender and real mail.                                                                                                                                                                                     |
| **A full-access Resend API key**                  | Resend → API Keys                              | The current key is send-only, so the domain-verification check cannot read anything. Needed for `pnpm doctor` and the console to report the real state.                                                                                                                                                                                                                       |
| **Verify the sending domain**                     | Resend → Domains                               | The last thing keeping email marked _in progress_. Add `iitgtic.com`, publish the records it returns, then set `RESEND_FROM` to an address on it.                                                                                                                                                                                                                             |
| **Rehearse a real restore**                       | A scratch Supabase project                     | `pnpm backup` is now complete and `pnpm restore --dry-run` passes; what is untested is writing a backup back into a live database. Needs a project that can be thrown away afterwards.                                                                                                                                                                                        |

---

<sub>IIT Guwahati Technology Incubation Centre · frontend-iitgtic.vercel.app</sub>
