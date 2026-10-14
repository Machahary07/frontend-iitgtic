-- A wait before a declined startup applies again.
--
-- rejected_at   when it was turned down. reviewed_at moves on every status
--               change, so it cannot say this reliably.
-- reapply_from  when the startup may apply again. The server works it out from
--               REAPPLY_WAIT_MONTHS ($lib/utils/applicationReject) as it rejects,
--               so the length of the wait lives in one place; changing it applies
--               to rejections from then on.
-- reapply_allowed_at
--               admin lifted the wait early ("Allow reapplying now").
--
-- All three are cleared when the application is reopened. Rejections from
-- before this migration keep reapply_from empty: they never had a wait.
--
-- The founder console hides "Apply again" while the wait runs, but the insert
-- itself comes from the browser, so the policy enforces it too. It also now
-- checks the application is for one of the caller's own companies: the wait is
-- per company, and an insert under someone else's company id (or none) would
-- otherwise step around it.

alter table public.applications
  add column if not exists rejected_at timestamptz,
  add column if not exists reapply_from timestamptz,
  add column if not exists reapply_allowed_at timestamptz;

update public.applications
   set rejected_at = reviewed_at
 where status = 'rejected' and rejected_at is null;

-- Whether the company's latest application leaves it free to apply. Definer, so
-- the check sees the row whoever on the team filed it.
create or replace function public.reapply_wait_over(company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select not (
      a.status = 'rejected'
      and a.reapply_allowed_at is null
      and a.reapply_from is not null
      and a.reapply_from > now()
    )
      from public.applications a
     where a.company_id = company
     order by a.created_at desc
     limit 1
  ), true);
$$;

revoke execute on function public.reapply_wait_over(uuid) from public, anon;
grant execute on function public.reapply_wait_over(uuid) to authenticated;

drop policy if exists "applications: insert own" on public.applications;
create policy "applications: insert own"
  on public.applications for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.email_verified
    )
    and company_id in (select public.my_company_ids())
    and public.reapply_wait_over(company_id)
  );
