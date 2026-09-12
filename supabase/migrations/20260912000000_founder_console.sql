-- ---------------------------------------------------------------------------
-- Founder console.
--
-- One sign-in for everyone (/login) and one place for a founder to work from
-- (/founder). What used to be the company job-posting portal now lives there,
-- alongside the incubation application, the team under a company, and an
-- activity trail.
--
-- Two changes of shape underneath it:
--
--   1. Two roles, not three. 'company' is gone: a person is a founder or a TIC
--      admin. A company is no longer an account you log in as — it is something
--      a founder creates, and a founder may create several.
--
--   2. Nothing a founder does reaches the public site until a TIC admin
--      approves it. Four queues: the company itself, its job postings, changes
--      to its public details, and anyone added to its team.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. companies belong to a founder, rather than being one
-- ---------------------------------------------------------------------------
-- companies.id used to BE the auth user id, which is what limited an account to
-- exactly one company. It becomes an ordinary generated key with an owner
-- beside it; every existing row keeps the id it has, so jobs, applicants and
-- resumes all still point at the right company.

alter table public.companies
  add column if not exists owner_id uuid references auth.users (id) on delete cascade;

-- The id was the owner's auth user id, so the backfill is exact.
update public.companies set owner_id = id where owner_id is null;

-- The old identity link has to go before a second company can exist for anyone.
alter table public.companies drop constraint if exists companies_id_fkey;
alter table public.companies alter column id set default gen_random_uuid();
alter table public.companies alter column owner_id set not null;

create index if not exists companies_owner_id_idx on public.companies (owner_id);

-- ---------------------------------------------------------------------------
-- 2. profiles: two roles, and the company a team member belongs to
-- ---------------------------------------------------------------------------

update public.profiles set role = 'founder' where role = 'company';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('founder', 'admin'));

-- Only set for someone a founder ADDED to a company. A founder's own link to
-- the companies they created is companies.owner_id, because there can be more
-- than one of them.
alter table public.profiles
  add column if not exists company_id    uuid references public.companies (id) on delete set null,
  add column if not exists member_status text not null default 'approved';

alter table public.profiles drop constraint if exists profiles_member_status_check;
alter table public.profiles
  add constraint profiles_member_status_check
  check (member_status in ('pending', 'approved', 'rejected'));

create index if not exists profiles_company_id_idx on public.profiles (company_id);

-- Written by an earlier draft of this migration that treated the owner as a
-- member of their own company; the two are separate now.
update public.profiles p
   set company_id = null
 where p.company_id is not null
   and exists (select 1 from public.companies c where c.id = p.company_id and c.owner_id = p.id);

-- company_id / member_status are absent from the grants below on purpose:
-- nobody adds themselves to a company, and nobody approves themselves.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, role, full_name, email, phone) on public.profiles to authenticated;
grant update (full_name, email, phone) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 3. "my companies" — the one definition everything else is scoped by
-- ---------------------------------------------------------------------------
-- Every policy below asks the same question: is this row one of mine? Asking it
-- in one security-definer function means the answer cannot drift between them,
-- and means a founder with three companies is handled the same as one with one.

create or replace function public.my_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id from public.companies c where c.owner_id = auth.uid()
  union
  select p.company_id
    from public.profiles p
   where p.id = auth.uid()
     and p.company_id is not null
     and p.member_status = 'approved';
$$;

grant execute on function public.my_company_ids() to authenticated;

-- Everyone who may act for a company: its owner, plus its approved members.
create or replace function public.company_member_ids(company uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select owner_id from public.companies where id = company
  union
  select id from public.profiles where company_id = company;
$$;

-- ---------------------------------------------------------------------------
-- 4. companies: policies for the new ownership
-- ---------------------------------------------------------------------------

drop policy if exists "companies: read own"   on public.companies;
drop policy if exists "companies: insert own" on public.companies;
drop policy if exists "companies: update own" on public.companies;
drop policy if exists "companies: delete own" on public.companies;

create policy "companies: read mine"
  on public.companies for select to authenticated
  using (owner_id = auth.uid() or id in (select public.my_company_ids()));

-- A founder creates their own companies. status is not in the grants, so a new
-- one starts 'pending' and only TIC can move it.
create policy "companies: create own"
  on public.companies for insert to authenticated
  with check (owner_id = auth.uid());

create policy "companies: delete own"
  on public.companies for delete to authenticated
  using (owner_id = auth.uid());

-- The public-facing columns are no longer self-service: they appear beside every
-- role on the board, so a change to them goes through the queue in §6 and is
-- written by the admin verdict. Only the login-facing email stays direct.
revoke all on public.companies from anon, authenticated;
grant select on public.companies to authenticated;
grant delete on public.companies to authenticated;
grant insert (owner_id, email, company_name, company_slug, website, contact_name, contact_email, phone)
  on public.companies to authenticated;
grant update (email) on public.companies to authenticated;

-- Was `status = 'verified'` on a company whose id was the caller's; the id no
-- longer means that, but the function's own meaning is unchanged.
create or replace function public.is_company_verified(company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.companies c where c.id = company and c.status = 'verified');
$$;

-- ---------------------------------------------------------------------------
-- 5. jobs: an approval state of their own
-- ---------------------------------------------------------------------------
-- A verified company was previously enough to put a role on the public board.
-- It no longer is: the company must be verified AND the posting approved.

alter table public.jobs
  add column if not exists status       text not null default 'pending',
  add column if not exists review_note  text,
  add column if not exists reviewed_at  timestamptz,
  add column if not exists reviewed_by  uuid references auth.users (id) on delete set null,
  add column if not exists submitted_at timestamptz not null default now();

alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs
  add constraint jobs_status_check check (status in ('pending', 'approved', 'rejected'));

create index if not exists jobs_status_idx on public.jobs (status);

-- Everything that existed before this migration was already live on the board,
-- so approving it keeps the public page exactly as it is today.
update public.jobs set status = 'approved' where created_at < now();

drop policy if exists "jobs: public read verified" on public.jobs;
drop policy if exists "jobs: public read approved" on public.jobs;
create policy "jobs: public read approved"
  on public.jobs for select to anon, authenticated
  using (status = 'approved' and public.is_company_verified(company_id));

-- The write policies go without replacement. A founder no longer inserts into
-- this table from the browser at all: /api/founder/jobs holds the service key,
-- checks the company against the caller, and sets the approval state — which is
-- precisely the thing the author must not be able to set for themselves.
drop policy if exists "jobs: read own"   on public.jobs;
drop policy if exists "jobs: insert own" on public.jobs;
drop policy if exists "jobs: update own" on public.jobs;
drop policy if exists "jobs: delete own" on public.jobs;

create policy "jobs: read mine"
  on public.jobs for select to authenticated
  using (company_id in (select public.my_company_ids()));

-- status, review_note, reviewed_at and reviewed_by stay out of the grants: a
-- founder writes the content of a posting, never its verdict. Writes go through
-- /api/founder/jobs, which is also where the queueing is decided.
revoke all on public.jobs from anon, authenticated;
grant select on public.jobs to anon, authenticated;

-- An edit to a live role takes it off the board and back into the queue.
--
-- The service role is exempt, and that exemption is the point: the admin routes
-- are the ones that approve a posting and the ones that rewrite every posting's
-- company name when a rename is approved, and neither of those is an edit by the
-- founder. Those routes set the status themselves when it should change —
-- /api/founder/jobs queues its own edits explicitly for exactly that reason.
create or replace function public.jobs_reset_status_on_edit()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;

  if (new.role, new.company, new.company_slug, new.location, new.type, new.sector,
      new.description, new.apply_link)
     is distinct from
     (old.role, old.company, old.company_slug, old.location, old.type, old.sector,
      old.description, old.apply_link)
  then
    new.status := 'pending';
    new.review_note := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_reset_status_on_edit on public.jobs;
create trigger jobs_reset_status_on_edit
  before update on public.jobs
  for each row execute function public.jobs_reset_status_on_edit();

-- ---------------------------------------------------------------------------
-- 6. company_profile_changes: a company edit waits for sign-off
-- ---------------------------------------------------------------------------

create table if not exists public.company_profile_changes (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  changes      jsonb not null default '{}'::jsonb,
  review_note  text,
  reviewed_at  timestamptz,
  reviewed_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists company_profile_changes_company_idx on public.company_profile_changes (company_id);
create index if not exists company_profile_changes_status_idx on public.company_profile_changes (status);

drop trigger if exists company_profile_changes_touch_updated_at on public.company_profile_changes;
create trigger company_profile_changes_touch_updated_at
  before update on public.company_profile_changes
  for each row execute function public.touch_updated_at();

alter table public.company_profile_changes enable row level security;

drop policy if exists "company profile changes: read own" on public.company_profile_changes;
create policy "company profile changes: read mine"
  on public.company_profile_changes for select to authenticated
  using (company_id in (select public.my_company_ids()));

revoke all on public.company_profile_changes from anon, authenticated;
grant select on public.company_profile_changes to authenticated;

-- ---------------------------------------------------------------------------
-- 7. the incubation application belongs to a company
-- ---------------------------------------------------------------------------
-- An application used to hang off the person who filled it in. A founder can now
-- run more than one startup, so it hangs off the startup instead — and the
-- wizard starts by asking which one.

alter table public.applications
  add column if not exists company_id uuid references public.companies (id) on delete set null;

create index if not exists applications_company_id_idx on public.applications (company_id);

-- An existing application was filled in by an account that had exactly one
-- company, if it had any, so the match is unambiguous.
update public.applications a
   set company_id = c.id
  from public.companies c
 where a.company_id is null and c.owner_id = a.user_id;

drop policy if exists "applications: read own"   on public.applications;
drop policy if exists "applications: insert own" on public.applications;
drop policy if exists "applications: update own" on public.applications;

-- Readable and writable by whoever filled it in, and readable by anyone else who
-- works for the same startup.
create policy "applications: read mine"
  on public.applications for select to authenticated
  using (
    auth.uid() = user_id
    or (company_id is not null and company_id in (select public.my_company_ids()))
  );

create policy "applications: insert own"
  on public.applications for insert to authenticated
  with check (auth.uid() = user_id);

create policy "applications: update own"
  on public.applications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.applications from anon, authenticated;
grant select on public.applications to authenticated;
grant insert (user_id, company_id, full_name, email, startup_name, answers, documents)
  on public.applications to authenticated;
grant update (company_id, full_name, email, startup_name, answers, documents)
  on public.applications to authenticated;

-- ---------------------------------------------------------------------------
-- 8. the applicant inbox follows the same "my companies" rule
-- ---------------------------------------------------------------------------

drop policy if exists "job applications: company reads own" on public.job_applications;
create policy "job applications: company reads own"
  on public.job_applications for select to authenticated
  using (
    company_id is not null
    and company_id in (select public.my_company_ids())
    and public.is_company_verified(company_id)
  );

-- Resumes live at `<job-slug>/<file>`, so the first folder segment names the
-- role. "Owned by the caller" is now "posted by one of my companies".
create or replace function public.company_owns_job_slug(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.jobs j
     where j.slug = p_slug
       and j.company_id in (select public.my_company_ids())
       and public.is_company_verified(j.company_id)
  );
$$;

drop policy if exists "job resumes: company reads own role" on storage.objects;
create policy "job resumes: company reads own role"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'job-applications'
    and public.company_owns_job_slug((storage.foldername(name))[1])
  );

-- ---------------------------------------------------------------------------
-- 9. signup trigger: no more company accounts
-- ---------------------------------------------------------------------------
-- Signing up creates a person, never a company. A founder creates companies
-- from the console afterwards; someone a founder ADDS to a company arrives with
-- company_id in their metadata and waits for TIC.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_company_id uuid := nullif(new.raw_user_meta_data ->> 'company_id', '')::uuid;
begin
  insert into public.profiles (id, role, full_name, email, phone, company_id, member_status)
  values (
    new.id,
    'founder',
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    meta_company_id,
    case when meta_company_id is not null then 'pending' else 'approved' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
