-- Three things the backend was missing, plus one storage policy that was.
--
--   1. A verified company can read the applicants for roles it posted.
--   2. Public writes are rate limited in the database, not in a process.
--   3. Resend's bounce and complaint webhooks are recorded, and an address that
--      hard-bounced or complained is never mailed again.

-- ---------------------------------------------------------------------------
-- 1. company-side applicant inbox
-- ---------------------------------------------------------------------------

-- job_applications has had RLS on with no policies since it was created: every
-- read went through the TIC console's service role. The row already carries the
-- company_id, so the company that posted the role can be given its own slice.
--
-- Two conditions, both required. The row must belong to the caller's company,
-- and that company must still be verified — a rejected account loses the inbox
-- the same way it loses the ability to post.

drop policy if exists "job applications: company reads own" on public.job_applications;
create policy "job applications: company reads own"
  on public.job_applications for select to authenticated
  using (
    company_id is not null
    and company_id = auth.uid()
    and public.is_company_verified(company_id)
  );

-- Column-level, so `review_note` and `reviewed_at` stay out of reach: those are
-- the TIC team's internal notes on a candidate, written for TIC and not for the
-- company. Everything the company needs to act on an application is here.
--
-- A column grant means `select *` fails for the authenticated role — the client
-- has to name its columns, which is what keeps a future column from leaking by
-- default.
grant select (
  id, job_id, company_id, job_slug, job_role, job_company, job_source,
  full_name, email, phone, applicant_role, portfolio_link, why,
  start_date, onsite_ok, consent, resume, status, created_at, updated_at
) on public.job_applications to authenticated;

-- Resolves a resume's folder (the job slug) back to its owner. security definer
-- so the lookup is not itself filtered by the jobs policies.
create or replace function public.company_owns_job_slug(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.jobs j
    where j.slug = p_slug and j.company_id = auth.uid()
  );
$$;

-- Resumes are uploaded to `<job-slug>/<timestamp>-<name>`, so the first folder
-- segment is the role. Select only: the company reads and signs its own URLs,
-- and cannot add to or delete from the bucket.
drop policy if exists "job resumes: company reads own role" on storage.objects;
create policy "job resumes: company reads own role"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'job-applications'
    and public.is_company_verified(auth.uid())
    and public.company_owns_job_slug((storage.foldername(name))[1])
  );

-- ---------------------------------------------------------------------------
-- 2. rate limiting
-- ---------------------------------------------------------------------------

-- Turnstile plus one-application-per-email was the only brake on the public
-- write routes. Neither stops a scripted caller working through addresses with
-- solved tokens, and neither applies at all to the admin login.
--
-- The counter lives in Postgres rather than in the running process because the
-- app is serverless: an in-memory map is per-instance, resets on every cold
-- start, and is trivially defeated by fanning requests across instances.

create table if not exists public.rate_limits (
  bucket       text not null,
  identifier   text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (bucket, identifier, window_start)
);

create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Fixed windows rather than a sliding log: one row per caller per window, and
-- the insert-or-increment is a single atomic statement, so two concurrent
-- requests cannot both read the count before either writes it.
--
-- Returns true when the request is allowed. The caller decides what a block
-- means — a 429 on a public form, a slower failure on a login.
create or replace function public.rate_limit_hit(
  p_bucket         text,
  p_identifier     text,
  p_window_seconds integer,
  p_max_hits       integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w     timestamptz;
  hits  integer;
begin
  w := to_timestamp(
    floor(extract(epoch from now()) / greatest(p_window_seconds, 1)) * greatest(p_window_seconds, 1)
  );

  insert into public.rate_limits as rl (bucket, identifier, window_start, count)
  values (p_bucket, p_identifier, w, 1)
  on conflict (bucket, identifier, window_start)
    do update set count = rl.count + 1
  returning rl.count into hits;

  return hits <= p_max_hits;
end;
$$;

revoke all on function public.rate_limit_hit(text, text, integer, integer) from anon, authenticated;

-- Windows older than a day are dead weight. Called opportunistically by the
-- limiter rather than scheduled, so the table stays small without pg_cron.
create or replace function public.rate_limit_sweep()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;

revoke all on function public.rate_limit_sweep() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. delivery feedback — bounces and complaints
-- ---------------------------------------------------------------------------

-- email_log records what we handed to Resend. It cannot record what happened
-- afterwards: a hard bounce, a spam complaint, or a delivery confirmation all
-- arrive later, as a webhook. Without them the console shows a message as
-- 'sent' that in fact never reached anyone.

create table if not exists public.email_events (
  id           uuid primary key default gen_random_uuid(),
  provider_id  text,
  type         text not null,
  to_email     text not null default '',
  occurred_at  timestamptz not null default now(),
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists email_events_provider_idx on public.email_events (provider_id);
create index if not exists email_events_email_idx on public.email_events (lower(to_email));
create index if not exists email_events_occurred_idx on public.email_events (occurred_at desc);

-- One row per provider event. Resend retries a webhook it did not get a 2xx
-- for, so the same event can arrive twice; this keeps the second one out.
create unique index if not exists email_events_once_idx
  on public.email_events (provider_id, type, occurred_at)
  where provider_id is not null;

alter table public.email_events enable row level security;
revoke all on public.email_events from anon, authenticated;

-- Continuing to mail an address that hard-bounced or reported us as spam is
-- what gets a sending domain blocked, so a suppressed address is refused before
-- the send rather than after.
create table if not exists public.email_suppressions (
  email      text primary key,
  reason     text not null check (reason in ('bounced', 'complained', 'manual')),
  detail     text,
  created_at timestamptz not null default now()
);

alter table public.email_suppressions enable row level security;
revoke all on public.email_suppressions from anon, authenticated;

drop trigger if exists audit_email_suppressions on public.email_suppressions;
create trigger audit_email_suppressions
  after insert or update or delete on public.email_suppressions
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- 4. application documents — the missing delete policy
-- ---------------------------------------------------------------------------

-- The bucket had read / upload / replace policies for the owner but no delete,
-- so an applicant who attached the wrong file could overwrite it but never
-- remove it. The folder is the user id, exactly as in the other three.
drop policy if exists "application docs: delete own" on storage.objects;
create policy "application docs: delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
