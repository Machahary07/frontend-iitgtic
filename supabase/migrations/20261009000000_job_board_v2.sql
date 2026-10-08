-- Job board v2: one table for every role, no approval queue.
--
-- 1. TIC's own roles move out of site_content into public.jobs, owner 'tic' and
--    no company. Startup roles are owner 'incubatee'. One form, one board query,
--    one apply route for both.
-- 2. A posting goes live the moment it is saved. The approval columns become the
--    removal record: TIC can take an incubatee's role down with a reason, which
--    the founder reads in their console and by email.
-- 3. Status is open / closed / removed. Closed is the author's own "stop taking
--    applications"; removed is TIC's call and only TIC can undo it.
-- 4. New fields: work mode, pay, closing date, and Part-time as a type. The apply
--    link goes: everyone applies through the site's own form.

-- ---------------------------------------------------------------------------
-- 1. the approval trigger and the apply link
-- ---------------------------------------------------------------------------

drop trigger if exists jobs_reset_status_on_edit on public.jobs;
drop function if exists public.jobs_reset_status_on_edit();

alter table public.jobs drop constraint if exists jobs_apply_link_scheme;
alter table public.jobs drop column if exists apply_link;

-- ---------------------------------------------------------------------------
-- 2. owner, new fields
-- ---------------------------------------------------------------------------

alter table public.jobs alter column company_id drop not null;

alter table public.jobs
  add column if not exists owner     text not null default 'incubatee',
  add column if not exists work_mode text not null default 'On-site',
  add column if not exists pay       text not null default '',
  add column if not exists closes_on date;

alter table public.jobs drop constraint if exists jobs_owner_check;
alter table public.jobs
  add constraint jobs_owner_check check (
    (owner = 'tic' and company_id is null) or (owner = 'incubatee' and company_id is not null)
  );

-- Read off the location text, which is where the old form asked people to say it.
update public.jobs set work_mode = case
  when location ~* 'remote' then 'Remote'
  when location ~* 'hybrid' then 'Hybrid'
  else 'On-site'
end;

alter table public.jobs drop constraint if exists jobs_work_mode_check;
alter table public.jobs
  add constraint jobs_work_mode_check check (work_mode in ('On-site', 'Hybrid', 'Remote'));

update public.jobs set type = case
  when type ~* '^intern' then 'Internship'
  when type ~* '^part' then 'Part-time'
  else 'Full-time'
end;

alter table public.jobs drop constraint if exists jobs_type_check;
alter table public.jobs
  add constraint jobs_type_check check (type in ('Full-time', 'Part-time', 'Internship'));

-- ---------------------------------------------------------------------------
-- 3. status: open / closed / removed
-- ---------------------------------------------------------------------------

alter table public.jobs rename column review_note to removed_reason;
alter table public.jobs rename column reviewed_at to removed_at;
alter table public.jobs rename column reviewed_by to removed_by;

alter table public.jobs drop constraint if exists jobs_status_check;

-- Waiting roles go live, as every new one now does. A role TIC sent back was
-- never public, so it stays down, carrying the reason it was given.
update public.jobs set status = 'open' where status in ('approved', 'pending');
update public.jobs set status = 'removed',
                       removed_at = coalesce(removed_at, now())
  where status = 'rejected';

alter table public.jobs alter column status set default 'open';
alter table public.jobs
  add constraint jobs_status_check check (status in ('open', 'closed', 'removed'));

create index if not exists jobs_owner_status_idx on public.jobs (owner, status);

-- ---------------------------------------------------------------------------
-- 4. what the public may read
-- ---------------------------------------------------------------------------

drop policy if exists "jobs: public read approved" on public.jobs;
drop policy if exists "jobs: public read open" on public.jobs;
create policy "jobs: public read open"
  on public.jobs for select to anon, authenticated
  using (
    status = 'open'
    and (closes_on is null or closes_on >= current_date)
    and (owner = 'tic' or public.is_company_verified(company_id))
  );

-- ---------------------------------------------------------------------------
-- 5. TIC's roles out of site_content
-- ---------------------------------------------------------------------------

insert into public.jobs (
  owner, company_id, slug, role, company, company_slug, location, type, work_mode,
  sector, posted, description, status
)
select
  'tic',
  null,
  p ->> 'slug',
  coalesce(nullif(p ->> 'role', ''), 'Untitled role'),
  coalesce(nullif(p ->> 'company', ''), 'IITG TIC'),
  coalesce(nullif(p ->> 'companySlug', ''), 'iitg-tic'),
  coalesce(p ->> 'location', ''),
  case
    when p ->> 'type' ~* '^intern' then 'Internship'
    when p ->> 'type' ~* '^part' then 'Part-time'
    else 'Full-time'
  end,
  case
    when p ->> 'location' ~* 'remote' then 'Remote'
    when p ->> 'location' ~* 'hybrid' then 'Hybrid'
    else 'On-site'
  end,
  coalesce(p ->> 'sector', ''),
  case
    when p ->> 'posted' ~ '^\d{4}-\d{2}-\d{2}' then left(p ->> 'posted', 10)::date
    else current_date
  end,
  coalesce(nullif(p ->> 'description', ''), '—'),
  'open'
from public.site_content sc,
     jsonb_array_elements(coalesce(sc.value::jsonb -> 'posts', '[]'::jsonb)) as p
where sc.key = 'pages.ticJobs'
  and coalesce(p ->> 'slug', '') <> ''
on conflict (slug) do nothing;

-- The posts lists are gone from both sections. Rebuilt with json_object_agg over
-- json_each so the remaining keys keep their order (value is json, not jsonb,
-- precisely so the editor's field order survives).
update public.site_content sc
   set value = coalesce(
     (select json_object_agg(e.key, e.value order by e.ord)
        from json_each(sc.value) with ordinality as e(key, value, ord)
       where e.key <> 'posts'),
     '{}'::json)
 where sc.key in ('pages.ticJobs', 'pages.startupJobs')
   and json_typeof(sc.value) = 'object';

-- ---------------------------------------------------------------------------
-- 6. applicants of TIC roles point at the row now
-- ---------------------------------------------------------------------------

alter table public.job_applications drop constraint if exists job_applications_job_source_check;
alter table public.job_applications
  add constraint job_applications_job_source_check check (job_source in ('seed', 'user', 'tic'));

update public.job_applications a
   set job_id = j.id, job_source = 'tic'
  from public.jobs j
 where j.slug = a.job_slug
   and j.owner = 'tic'
   and a.job_id is null;

-- ---------------------------------------------------------------------------
-- 7. storage limits: TIC pays for every resume, so the board is bounded
-- ---------------------------------------------------------------------------
-- PDF only, 2 MB. A role takes at most max_applicants (200 at most, lower if the
-- poster says so) and closes itself when full. Resumes are deleted 90 days after
-- a role ends; the poster is warned a week before and can download them all.

update storage.buckets
   set file_size_limit = 2097152,
       allowed_mime_types = array['application/pdf']
 where id = 'job-applications';

alter table public.jobs
  add column if not exists max_applicants     integer not null default 200,
  add column if not exists closed_at          timestamptz,
  add column if not exists resumes_warned_at  timestamptz,
  add column if not exists resumes_cleared_at timestamptz;

alter table public.jobs drop constraint if exists jobs_max_applicants_check;
alter table public.jobs
  add constraint jobs_max_applicants_check check (max_applicants between 1 and 200);

update public.jobs set closed_at = coalesce(closed_at, updated_at) where status = 'closed';

create index if not exists job_applications_job_id_idx on public.job_applications (job_id);
