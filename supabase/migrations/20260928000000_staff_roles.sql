-- TIC staff roles.
--
-- Until now the console had one staff role, 'admin'. The team is wider than
-- that — a CEO, a chairman, coordinators — and each needs a narrower slice of
-- the console than the people who run it. What each role may open is decided
-- in the app ($lib/utils/roles.ts); the database only has to know the names.
--
-- 'developer' is the one above admin: everything an admin has, plus "view as",
-- which opens the console as any other account to check what they see.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in (
    'founder',
    'developer',
    'admin',
    'tic_admin',
    'tic_ceo',
    'tic_chairman',
    'tic_coordinator',
    'tic_head',
    'tic_president'
  ));

-- A developer is a superset of an admin, so anything gated on is_admin() must
-- keep letting them through. The tic_* roles are deliberately not included:
-- their access is narrower and is enforced by the app, section by section.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = uid and role in ('admin', 'developer'));
$$;

-- The bootstrap window closes once anyone can run the console — a developer
-- counts, not only an admin.
create or replace function public.admin_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.profiles where role in ('admin', 'developer');
$$;

-- What a member of staff is responsible for, and where they sit. Written only by
-- the console's Users screen (service role), like role itself.
alter table public.profiles
  add column if not exists responsibility text not null default '',
  add column if not exists department     text not null default '';
