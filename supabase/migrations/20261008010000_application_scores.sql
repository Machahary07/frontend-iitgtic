-- Marks out of 100, one per reviewer per step of an application. Each reviewer
-- sees only their own; admin sees everyone's. The applicant sees the per-step
-- averages, with no names, in the decision email.
--
-- `role` is what the scorer held when they marked it, so the breakdown still
-- reads right if their role changes later.

create table if not exists public.application_scores (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  role           text not null,
  step           smallint not null check (step between 1 and 8),
  score          smallint not null check (score between 0 and 100),
  updated_at     timestamptz not null default now(),
  unique (application_id, user_id, step)
);

create index if not exists application_scores_application_idx
  on public.application_scores (application_id);

-- Service role only: the console reads and writes it on the server.
alter table public.application_scores enable row level security;
revoke all on public.application_scores from anon, authenticated;

drop trigger if exists audit_application_scores on public.application_scores;
create trigger audit_application_scores
  after insert or update or delete on public.application_scores
  for each row execute function public.audit_trigger();
