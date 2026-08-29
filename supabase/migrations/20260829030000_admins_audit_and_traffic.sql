-- Individual admin accounts, a tamper-evident audit trail, and page-visit logging.
--
-- Until now every TIC admin shared one password, so no action could be attributed
-- to a person. Admins are now ordinary Supabase Auth users carrying role 'admin'
-- on their profile, and the audit trail records who did what at the database
-- level — a row changed through the SQL editor is captured just like a click.

-- ---------------------------------------------------------------------------
-- 1. the admin role
-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('founder', 'company', 'admin'));

-- A user cannot promote themselves: role is not in the authenticated grants, so
-- only the service role (the admin routes) can change it.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, role, full_name, email, phone) on public.profiles to authenticated;
grant update (full_name, email, phone) on public.profiles to authenticated;

create index if not exists profiles_role_idx on public.profiles (role);

-- Used by the login route and the admin guards.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = uid and role = 'admin');
$$;

-- True while no admin exists — the bootstrap window in which the shared
-- TIC_ADMIN_PASSWORD may still be used to create the first account.
create or replace function public.admin_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.profiles where role = 'admin';
$$;

-- ---------------------------------------------------------------------------
-- 2. audit log
-- ---------------------------------------------------------------------------

create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  source       text not null default 'trigger' check (source in ('trigger', 'app')),
  actor_id     uuid,
  actor_label  text not null default 'unknown',
  action       text not null,
  table_name   text,
  record_id    text,
  before       jsonb,
  after        jsonb
);

create index if not exists audit_log_occurred_at_idx on public.audit_log (occurred_at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id);
create index if not exists audit_log_table_idx on public.audit_log (table_name);

-- No policies and no grants: RLS on with zero policies denies every anon and
-- authenticated request. Only the service role reads or writes this table.
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;

-- Resolves the acting user. A browser write carries a JWT, so auth.uid() is set.
-- A service-role write from an admin route carries an x-actor-id header instead,
-- which PostgREST exposes through the request.headers setting.
create or replace function public.audit_actor()
returns uuid
language plpgsql
stable
as $$
declare
  header_actor text;
begin
  if auth.uid() is not null then
    return auth.uid();
  end if;

  begin
    header_actor := current_setting('request.headers', true)::json ->> 'x-actor-id';
  exception
    when others then
      header_actor := null;
  end;

  if header_actor is null or header_actor = '' then
    return null;
  end if;

  return header_actor::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.audit_actor();
  label text;
  rec_id text;
begin
  select coalesce(nullif(p.full_name, ''), p.email, actor::text) || ' (' || p.role || ')'
    into label
  from public.profiles p
  where p.id = actor;

  if label is null then
    label := case when actor is null then 'system' else actor::text end;
  end if;

  rec_id := case
    when tg_op = 'DELETE' then (to_jsonb(old) ->> 'id')
    else (to_jsonb(new) ->> 'id')
  end;

  insert into public.audit_log (source, actor_id, actor_label, action, table_name, record_id, before, after)
  values (
    'trigger',
    actor,
    label,
    lower(tg_op) || ' ' || tg_table_name,
    tg_table_name,
    rec_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return null;
end;
$$;

drop trigger if exists audit_companies on public.companies;
create trigger audit_companies
  after insert or update or delete on public.companies
  for each row execute function public.audit_trigger();

drop trigger if exists audit_jobs on public.jobs;
create trigger audit_jobs
  after insert or update or delete on public.jobs
  for each row execute function public.audit_trigger();

drop trigger if exists audit_applications on public.applications;
create trigger audit_applications
  after insert or update or delete on public.applications
  for each row execute function public.audit_trigger();

drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- 3. page views
-- ---------------------------------------------------------------------------

create table if not exists public.page_views (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  path        text not null,
  visitor_id  uuid not null,
  user_id     uuid references auth.users (id) on delete set null,
  actor_label text,
  is_admin    boolean not null default false,
  referrer    text,
  user_agent  text,
  status      integer,
  duration_ms integer
);

create index if not exists page_views_occurred_at_idx on public.page_views (occurred_at desc);
create index if not exists page_views_path_idx on public.page_views (path);
create index if not exists page_views_visitor_idx on public.page_views (visitor_id);
create index if not exists page_views_admin_idx on public.page_views (is_admin) where is_admin;

alter table public.page_views enable row level security;
revoke all on public.page_views from anon, authenticated;

-- Convenience views for the admin dashboard, read through the service role.
create or replace view public.page_view_daily as
  select date_trunc('day', occurred_at) as day,
         count(*) as views,
         count(distinct visitor_id) as visitors,
         count(*) filter (where is_admin) as admin_views
  from public.page_views
  group by 1
  order by 1 desc;

create or replace view public.page_view_top_paths as
  select path,
         is_admin,
         count(*) as views,
         count(distinct visitor_id) as visitors,
         max(occurred_at) as last_seen
  from public.page_views
  group by path, is_admin
  order by count(*) desc;

revoke all on public.page_view_daily from anon, authenticated;
revoke all on public.page_view_top_paths from anon, authenticated;
