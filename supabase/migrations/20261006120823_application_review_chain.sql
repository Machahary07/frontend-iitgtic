-- The review chain an application passes through before a startup is incubated.
--
--   0  submitted, admin has not checked it yet
--   1  admin checked it and passed it to the CEO
--   2  CEO is reviewing (set when the CEO first opens it)
--   3  coordinators the CEO assigned are reviewing
--   4  CEO rechecks the coordinators' notes
--   5  TIC heads the CEO (or admin) assigned are reviewing; once they are all
--      done it is back with admin for the final email
--   6  live: listed among the incubated startups
--
-- `status` stays the applicant-facing word (submitted / under-review / accepted
-- / rejected). `review_stage` is where it sits inside the team, and
-- `rejected_stage` keeps which step it was turned down at.
--
-- Who may see an application at which step is enforced by the app
-- ($lib/server/applicationReview.ts), like every other per-role rule.

alter table public.applications
  add column if not exists review_stage smallint not null default 0
    check (review_stage between 0 and 6),
  add column if not exists rejected_stage smallint
    check (rejected_stage between 0 and 6);

-- Existing rows: under review has at least passed admin, accepted has passed
-- everyone but the listing, and a rejection happened wherever the row stood.
update public.applications set review_stage = 1 where status = 'under-review' and review_stage = 0;
update public.applications set review_stage = 5 where status = 'accepted' and review_stage = 0;
update public.applications set rejected_stage = review_stage
  where status = 'rejected' and rejected_stage is null;

-- The named people an application is handed to. Only coordinators and heads
-- assigned here ever see it; each one's own note and sign-off live on their row.
create table if not exists public.application_reviewers (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  kind           text not null check (kind in ('coordinator', 'head')),
  assigned_by    uuid references public.profiles(id) on delete set null,
  assigned_at    timestamptz not null default now(),
  note           text,
  done_at        timestamptz,
  unique (application_id, user_id, kind)
);

create index if not exists application_reviewers_user_idx
  on public.application_reviewers (user_id);

-- Service role only: the console reads and writes it on the server, nobody
-- reaches it through the Data API.
alter table public.application_reviewers enable row level security;
revoke all on public.application_reviewers from anon, authenticated;

drop trigger if exists audit_application_reviewers on public.application_reviewers;
create trigger audit_application_reviewers
  after insert or update or delete on public.application_reviewers
  for each row execute function public.audit_trigger();
