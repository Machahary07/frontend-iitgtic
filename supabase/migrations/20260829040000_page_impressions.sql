-- Impressions, aggregated per page for the admin console's card grid.
--
-- Bots are separated from people: a crawler hitting /about 200 times should not
-- read as 200 visitors. Detection is user-agent based, which is approximate but
-- enough to stop the numbers being actively misleading.

create or replace function public.page_impressions(since timestamptz default null)
returns table (
  path        text,
  total       bigint,
  visitors    bigint,
  bots        bigint,
  admin_views bigint,
  is_admin    boolean,
  last_seen   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with tagged as (
    select
      pv.path,
      pv.visitor_id,
      pv.is_admin,
      pv.occurred_at,
      coalesce(pv.user_agent, '') ~* '(bot|crawler|spider|slurp|bingpreview|headless|curl/|wget|python-requests|axios|node-fetch|monitoring|lighthouse)'
        as is_bot
    from public.page_views pv
    where since is null or pv.occurred_at >= since
  )
  select
    t.path,
    count(*)::bigint                                                as total,
    count(distinct t.visitor_id) filter (where not t.is_bot)::bigint as visitors,
    count(*) filter (where t.is_bot)::bigint                         as bots,
    count(*) filter (where t.is_admin)::bigint                       as admin_views,
    bool_or(t.is_admin)                                              as is_admin,
    max(t.occurred_at)                                               as last_seen
  from tagged t
  group by t.path
  order by count(*) desc;
$$;

revoke all on function public.page_impressions(timestamptz) from anon, authenticated;
