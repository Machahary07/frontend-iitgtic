-- The reapply wait follows the founder too, not only the startup.
--
-- 20261014000000_reapply_wait.sql made the wait per company, so a founder whose
-- startup was turned down could register a new company and apply under it the
-- same day. The check now also refuses while any rejection still waiting
-- (reapply_from ahead, not lifted by admin) was filed by the caller, or was for
-- a company the caller owns — so it holds whichever account on the team filed
-- the first one. "Allow reapplying now" on that rejection lifts both.
--
-- Same signature, so "applications: insert own" picks it up unchanged.

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
  ), true)
  and not exists (
    select 1
      from public.applications a
     where a.status = 'rejected'
       and a.reapply_allowed_at is null
       and a.reapply_from > now()
       and (
         a.user_id = auth.uid()
         or a.company_id in (select c.id from public.companies c where c.owner_id = auth.uid())
       )
  );
$$;
