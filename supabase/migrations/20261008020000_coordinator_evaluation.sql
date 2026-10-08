-- The coordinators' screening call. Admin sets up a Google Meet for an
-- application at stage 3, the assigned coordinators join it and each scores the
-- startup against the evaluation criteria (0–10, with an optional remark), and
-- admin ends the meeting once everyone has submitted — which passes it to the
-- CEO for the recheck (stage 4).
--
-- A coordinator's submission is application_reviewers.done_at. Until then their
-- rows here are an auto-saved draft.

alter table public.applications
  add column if not exists meet_url text,
  add column if not exists meet_at timestamptz,
  add column if not exists meeting_ended_at timestamptz;

create table if not exists public.evaluation_scores (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  criterion      text not null,
  score          smallint check (score between 0 and 10),
  remark         text,
  updated_at     timestamptz not null default now(),
  unique (application_id, user_id, criterion)
);

create index if not exists evaluation_scores_application_idx
  on public.evaluation_scores (application_id);

-- Service role only: the console reads and writes it on the server.
alter table public.evaluation_scores enable row level security;
revoke all on public.evaluation_scores from anon, authenticated;

drop trigger if exists audit_evaluation_scores on public.evaluation_scores;
create trigger audit_evaluation_scores
  after insert or update or delete on public.evaluation_scores
  for each row execute function public.audit_trigger();
