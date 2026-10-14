-- Undoes 20261014010000_reapply_wait_founder.sql: the wait goes back to per
-- company only, exactly as 20261014000000_reapply_wait.sql defined it. Run this
-- before 20261014000000_reapply_wait.down.sql if undoing both.

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
