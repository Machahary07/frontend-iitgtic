-- Applications to a role on the Opportunities board.
--
-- These come from the public detail page at /opportunities/[id], where the
-- applicant is a visitor rather than an account: there is no auth.uid() to hang
-- a policy off, so the table is service-role only and every write arrives
-- through /api/job-applications, which verifies a Turnstile token first.
--
-- A role can be one of the eight seed posts in content.json or a live row in
-- public.jobs, so the job is identified by its slug and the role/company names
-- are snapshotted alongside it. `job_id` and `company_id` are filled in for a
-- live posting only, and both survive the job being taken down.

create table if not exists public.job_applications (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid references public.jobs (id) on delete set null,
  company_id      uuid references public.companies (id) on delete set null,
  job_slug        text not null,
  job_role        text not null default '',
  job_company     text not null default '',
  job_source      text not null default 'user' check (job_source in ('seed', 'user')),
  full_name       text not null,
  email           text not null,
  phone           text not null default '',
  applicant_role  text not null default '',
  portfolio_link  text not null default '',
  why             text not null default '',
  start_date      date,
  onsite_ok       boolean not null default false,
  consent         boolean not null default false,
  resume          jsonb not null default '{}'::jsonb,
  status          text not null default 'new'
                    check (status in ('new', 'shortlisted', 'forwarded', 'rejected')),
  review_note     text,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists job_applications_created_at_idx on public.job_applications (created_at desc);
create index if not exists job_applications_status_idx on public.job_applications (status);
create index if not exists job_applications_job_slug_idx on public.job_applications (job_slug);
create index if not exists job_applications_company_idx on public.job_applications (company_id);

-- One application per person per role. The submit route turns the resulting
-- unique violation into "you have already applied to this role" rather than an
-- error page, and the case fold stops Ada@x and ada@x counting as two people.
create unique index if not exists job_applications_one_per_role_idx
  on public.job_applications (job_slug, lower(email));

create trigger job_applications_touch_updated_at
  before update on public.job_applications
  for each row execute function public.touch_updated_at();

-- RLS on with zero policies and no grants: anon and authenticated are denied
-- outright. Applicants never read this table back, and the TIC console reaches
-- it through the service role like every other admin surface.
alter table public.job_applications enable row level security;
revoke all on public.job_applications from anon, authenticated;

drop trigger if exists audit_job_applications on public.job_applications;
create trigger audit_job_applications
  after insert or update or delete on public.job_applications
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- storage — private bucket for resumes, one folder per role
-- ---------------------------------------------------------------------------

-- No storage policies either: the submit route uploads with the service role and
-- the console hands out short-lived signed URLs, so the objects are never public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-applications',
  'job-applications',
  false,
  5242880,
  array['application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;
