-- ---------------------------------------------------------------------------
-- Founder console.
--
-- One sign-in for everyone (/login) and one place for a startup to work from
-- (/founder). What used to be the company job-posting portal now lives there,
-- alongside the incubation application, the team under a company, and an
-- activity trail.
--
-- The rule the whole file exists to enforce: nothing a founder does reaches the
-- public site until a TIC admin approves it. That means three approval queues —
-- job postings, company profile changes, and team members — plus the existing
-- company verification and incubation review.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. jobs: an approval state of their own
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
update public.jobs set status = 'approved' where status = 'pending' and created_at < now();

drop policy if exists "jobs: public read verified" on public.jobs;
create policy "jobs: public read approved"
  on public.jobs for select to anon, authenticated
  using (status = 'approved' and public.is_company_verified(company_id));

-- status, review_note, reviewed_at and reviewed_by stay out of the grants: a
-- founder can write the content of a posting, never its verdict.
revoke all on public.jobs from anon, authenticated;
grant select on public.jobs to anon, authenticated;
grant insert (company_id, role, company, company_slug, location, type, sector, description, apply_link) on public.jobs to authenticated;
grant update (role, company, company_slug, location, type, sector, description, apply_link) on public.jobs to authenticated;
grant delete on public.jobs to authenticated;
grant usage on sequence public.job_slug_seq to authenticated;

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
-- 2. profiles: which company a person belongs to, and whether TIC let them in
-- ---------------------------------------------------------------------------
-- A founder can add people to their own company. The account exists straight
-- away — they can sign in and look around — but it cannot post or change
-- anything until a TIC admin approves the membership.

alter table public.profiles
  add column if not exists company_id    uuid references public.companies (id) on delete set null,
  add column if not exists member_role   text not null default 'owner',
  add column if not exists member_status text not null default 'approved';

alter table public.profiles drop constraint if exists profiles_member_role_check;
alter table public.profiles
  add constraint profiles_member_role_check check (member_role in ('owner', 'member'));

alter table public.profiles drop constraint if exists profiles_member_status_check;
alter table public.profiles
  add constraint profiles_member_status_check check (member_status in ('pending', 'approved', 'rejected'));

create index if not exists profiles_company_id_idx on public.profiles (company_id);

-- The account that signed the company up owns it. companies.id IS the auth user
-- id, so the owner's profile points at itself.
update public.profiles p
   set company_id = p.id, member_role = 'owner', member_status = 'approved'
 where p.company_id is null
   and exists (select 1 from public.companies c where c.id = p.id);

-- A member may read the other profiles in their company — the team list on
-- /founder/users is drawn from this. Writes stay service-role only.
drop policy if exists "profiles: read own company" on public.profiles;
create policy "profiles: read own company"
  on public.profiles for select to authenticated
  using (
    company_id is not null
    and company_id = (select company_id from public.profiles me where me.id = auth.uid())
  );

-- company_id / member_role / member_status are absent from the grants below on
-- purpose: nobody adds themselves to a company, and nobody approves themselves.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, role, full_name, email, phone) on public.profiles to authenticated;
grant update (full_name, email, phone) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 3. company_profile_changes: a company edit waits for sign-off
-- ---------------------------------------------------------------------------
-- The company name, website and contact details appear on the public board next
-- to every role, so a change to them is a change to public copy. The founder
-- edits into this queue; the admin verdict is what writes public.companies.

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

-- Readable by the company it belongs to, so the founder can see a request is
-- still waiting. Written only by the service role, from /api/founder/profile.
create policy "company profile changes: read own"
  on public.company_profile_changes for select to authenticated
  using (
    company_id = (select company_id from public.profiles me where me.id = auth.uid())
  );

revoke all on public.company_profile_changes from anon, authenticated;
grant select on public.company_profile_changes to authenticated;

-- A company may no longer write its own public-facing details directly; those
-- edits go through the queue above. Email stays writable because it is the
-- login address, not public copy.
revoke update (company_name, company_slug, website, contact_name, contact_email, phone)
  on public.companies from authenticated;

-- ---------------------------------------------------------------------------
-- 4. signup trigger: fill in the new columns
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text := coalesce(new.raw_user_meta_data ->> 'role', 'founder');
  meta_company text := coalesce(new.raw_user_meta_data ->> 'company_name', '');
  meta_company_id uuid := nullif(new.raw_user_meta_data ->> 'company_id', '')::uuid;
begin
  insert into public.profiles (id, role, full_name, email, phone, company_id, member_role, member_status)
  values (
    new.id,
    case when meta_role = 'company' then 'company' else 'founder' end,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    -- A member invited by a founder carries the company it was invited into;
    -- a company signing itself up owns the row it is about to create.
    case when meta_company_id is not null then meta_company_id
         when meta_role = 'company' then new.id
         else null end,
    case when meta_company_id is not null then 'member' else 'owner' end,
    -- An invited member waits for TIC; anyone signing themselves up is not yet
    -- attached to an approved company anyway, so there is nothing to hold back.
    case when meta_company_id is not null then 'pending' else 'approved' end
  )
  on conflict (id) do nothing;

  if meta_role = 'company' and meta_company_id is null then
    insert into public.companies (id, email, company_name, company_slug, website, contact_name, contact_email, phone)
    values (
      new.id,
      coalesce(new.email, ''),
      meta_company,
      left(public.slugify(meta_company), 64),
      coalesce(new.raw_user_meta_data ->> 'website', ''),
      coalesce(new.raw_user_meta_data ->> 'contact_name', ''),
      coalesce(new.raw_user_meta_data ->> 'contact_email', ''),
      coalesce(new.raw_user_meta_data ->> 'phone', '')
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. a founder's own activity
-- ---------------------------------------------------------------------------
-- The audit log stays service-role only. /founder/activity reads it through the
-- server with the service key and filters to the company's own people, so this
-- function is the single definition of "who counts as us".

create or replace function public.company_member_ids(company uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where company_id = company;
$$;
