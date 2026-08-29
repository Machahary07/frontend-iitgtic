-- IITG TIC — initial schema.
--
-- Four tables, all behind RLS:
--   profiles      one row per auth user (founder or company contact)
--   companies     job-portal accounts, approved by the TIC team
--   jobs          postings owned by a company, public only once the company is verified
--   applications  the 8-step incubation application
--
-- The TIC team admin does not authenticate through Supabase Auth (it uses a shared
-- password checked server-side), so every admin write goes through a SvelteKit
-- server route using the service-role key, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'company'
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'founder' check (role in ('founder', 'company')),
  full_name  text not null default '',
  email      text not null default '',
  phone      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: read own"   on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, role, full_name, email, phone) on public.profiles to authenticated;
grant update (full_name, email, phone) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------

create table if not exists public.companies (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text not null default '',
  company_name     text not null,
  company_slug     text not null,
  website          text not null default '',
  contact_name     text not null default '',
  status           text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  rejection_reason text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists companies_status_idx on public.companies (status);

create trigger companies_touch_updated_at
  before update on public.companies
  for each row execute function public.touch_updated_at();

alter table public.companies enable row level security;

create policy "companies: read own"   on public.companies for select to authenticated using (auth.uid() = id);
create policy "companies: insert own" on public.companies for insert to authenticated with check (auth.uid() = id);
create policy "companies: update own" on public.companies for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "companies: delete own" on public.companies for delete to authenticated using (auth.uid() = id);

-- status / rejection_reason are deliberately absent from the grants below: only the
-- service role (TIC admin routes) may verify or reject an account.
revoke all on public.companies from anon, authenticated;
grant select on public.companies to authenticated;
grant delete on public.companies to authenticated;
grant insert (id, email, company_name, company_slug, website, contact_name) on public.companies to authenticated;
grant update (email, company_name, company_slug, website, contact_name) on public.companies to authenticated;

-- Used by the jobs read policy. security definer so the lookup is not itself
-- filtered by the companies policies above.
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
-- jobs
-- ---------------------------------------------------------------------------

-- content.json ships eight seed posts, job-no-1 .. job-no-8, so live slugs start at 9.
create sequence if not exists public.job_slug_seq start with 9;

create table if not exists public.jobs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  slug         text not null unique default ('job-no-' || nextval('public.job_slug_seq')),
  role         text not null,
  company      text not null,
  company_slug text not null,
  location     text not null default '',
  type         text not null default 'Full-time',
  sector       text not null default '',
  posted       date not null default current_date,
  description  text not null,
  apply_link   text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint jobs_apply_link_scheme check (
    apply_link ~* '^(https?://|mailto:)'
  )
);

create index if not exists jobs_company_id_idx on public.jobs (company_id);
create index if not exists jobs_posted_idx on public.jobs (posted desc);

create trigger jobs_touch_updated_at
  before update on public.jobs
  for each row execute function public.touch_updated_at();

alter table public.jobs enable row level security;

create policy "jobs: public read verified"
  on public.jobs for select to anon, authenticated
  using (public.is_company_verified(company_id));

create policy "jobs: read own"
  on public.jobs for select to authenticated
  using (company_id = auth.uid());

create policy "jobs: insert own"
  on public.jobs for insert to authenticated
  with check (company_id = auth.uid());

create policy "jobs: update own"
  on public.jobs for update to authenticated
  using (company_id = auth.uid()) with check (company_id = auth.uid());

create policy "jobs: delete own"
  on public.jobs for delete to authenticated
  using (company_id = auth.uid());

revoke all on public.jobs from anon, authenticated;
grant select on public.jobs to anon, authenticated;
grant insert (company_id, role, company, company_slug, location, type, sector, description, apply_link) on public.jobs to authenticated;
grant update (role, company, company_slug, location, type, sector, description, apply_link) on public.jobs to authenticated;
grant delete on public.jobs to authenticated;
grant usage on sequence public.job_slug_seq to authenticated;

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------

create table if not exists public.applications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'submitted'
                 check (status in ('submitted', 'under-review', 'accepted', 'rejected')),
  full_name    text not null default '',
  email        text not null default '',
  startup_name text not null default '',
  answers      jsonb not null default '{}'::jsonb,
  documents    jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists applications_user_id_idx on public.applications (user_id);
create index if not exists applications_status_idx on public.applications (status);

create trigger applications_touch_updated_at
  before update on public.applications
  for each row execute function public.touch_updated_at();

alter table public.applications enable row level security;

create policy "applications: read own"   on public.applications for select to authenticated using (auth.uid() = user_id);
create policy "applications: insert own" on public.applications for insert to authenticated with check (auth.uid() = user_id);
create policy "applications: update own" on public.applications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- status stays out of the grants: only the TIC admin (service role) moves an
-- application through review.
revoke all on public.applications from anon, authenticated;
grant select on public.applications to authenticated;
grant insert (user_id, full_name, email, startup_name, answers, documents) on public.applications to authenticated;
grant update (full_name, email, startup_name, answers, documents) on public.applications to authenticated;

-- ---------------------------------------------------------------------------
-- signup trigger — one auth user becomes a profile, and a company row when the
-- signup metadata says role = 'company'.
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
begin
  insert into public.profiles (id, role, full_name, email, phone)
  values (
    new.id,
    case when meta_role = 'company' then 'company' else 'founder' end,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;

  if meta_role = 'company' then
    insert into public.companies (id, email, company_name, company_slug, website, contact_name)
    values (
      new.id,
      coalesce(new.email, ''),
      meta_company,
      left(public.slugify(meta_company), 64),
      coalesce(new.raw_user_meta_data ->> 'website', ''),
      coalesce(new.raw_user_meta_data ->> 'contact_name', '')
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- storage — private bucket for application attachments, one folder per user
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-documents',
  'application-documents',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

create policy "application docs: read own"
  on storage.objects for select to authenticated
  using (bucket_id = 'application-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "application docs: upload own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'application-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "application docs: replace own"
  on storage.objects for update to authenticated
  using (bucket_id = 'application-documents' and (storage.foldername(name))[1] = auth.uid()::text);
