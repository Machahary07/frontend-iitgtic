-- Public startup profiles: the pages under /incubated-startups.
--
-- They used to be hand-written inside site_content. Now each incubated startup
-- has one row here. The founder edits `draft` from their console and submits it;
-- TIC approves it in Approvals, which copies it to `published` — the only thing
-- the public site ever reads. A startup is listed once an admin marks it live.
--
-- Groups on the site:
--   Current    stage = 'current'                     (every current incubatee)
--   Virtual    stage = 'current' and is_virtual       (a subset of Current)
--   Graduated  stage = 'graduated'
-- 'exited' keeps the record but takes it off the site.
--
-- Service role only: RLS on, no policies. Every read and write goes through the
-- server, which checks the founder or the staff role itself.

create table if not exists public.startup_profiles (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid unique references public.companies (id) on delete cascade,
  slug          text not null unique,
  stage         text not null default 'current' check (stage in ('current', 'graduated', 'exited')),
  is_virtual    boolean not null default false,
  listed        boolean not null default false,
  published     jsonb,
  draft         jsonb not null default '{}'::jsonb,
  draft_status  text not null default 'draft'
                check (draft_status in ('draft', 'in_review', 'sent_back', 'approved')),
  review_note   text,
  submitted_at  timestamptz,
  reviewed_at   timestamptz,
  reviewed_by   uuid references auth.users (id) on delete set null,
  live_at       timestamptz,
  graduated_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists startup_profiles_listed_idx on public.startup_profiles (listed, stage);
create index if not exists startup_profiles_review_idx on public.startup_profiles (draft_status);

drop trigger if exists startup_profiles_touch_updated_at on public.startup_profiles;
create trigger startup_profiles_touch_updated_at
  before update on public.startup_profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists audit_startup_profiles on public.startup_profiles;
create trigger audit_startup_profiles
  after insert or update or delete on public.startup_profiles
  for each row execute function public.audit_trigger();

alter table public.startup_profiles enable row level security;
revoke all on public.startup_profiles from anon, authenticated;

-- Move the hand-written listings across. A startup listed under both Current and
-- Virtual becomes one current row with is_virtual set, so rows are grouped by
-- slug first.
insert into public.startup_profiles (slug, stage, is_virtual, listed, published, draft, draft_status, live_at)
select slug,
       case when graduated then 'graduated' else 'current' end,
       is_virtual and not graduated,
       true,
       data,
       data,
       'approved',
       now()
  from (
    select s ->> 'slug' as slug,
           bool_or(c ->> 'slug' = 'graduated') as graduated,
           bool_or(c ->> 'slug' = 'virtual') as is_virtual,
           (array_agg(s order by (c ->> 'slug') = 'virtual'))[1] as data
      from public.site_content sc,
           jsonb_array_elements(coalesce(sc.value::jsonb -> 'categories', '[]'::jsonb)) c,
           jsonb_array_elements(coalesce(c -> 'startups', '[]'::jsonb)) s
     where sc.key = 'pages.incubatedStartups'
       and coalesce(s ->> 'slug', '') <> ''
     group by s ->> 'slug'
  ) listed
on conflict (slug) do nothing;

-- The category pages keep their copy in site_content; the startups leave it.
-- site_content.value is json, not jsonb, so the editor keeps its field order:
-- the section is rebuilt key by key, in order, with each category's
-- `startups` dropped.
update public.site_content
   set value = (
     select json_object_agg(
              k,
              case
                when k = 'categories' then (
                  select json_agg(
                           (select json_object_agg(ck, cv order by cord)
                              from json_each(c) with ordinality as e (ck, cv, cord)
                             where ck <> 'startups')
                           order by ord)
                    from json_array_elements(v) with ordinality as a (c, ord)
                )
                else v
              end
              order by kord)
       from json_each(value) with ordinality as t (k, v, kord)
   )
 where key = 'pages.incubatedStartups'
   and value::jsonb ? 'categories';
