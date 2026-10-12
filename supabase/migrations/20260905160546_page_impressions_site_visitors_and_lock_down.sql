-- Two fixes to page_impressions.
--
-- 1. The site-wide visitor count cannot be summed from the per-path rows: a
--    person who reads five pages is a distinct visitor on each of them, so
--    adding the columns up counted them five times. The Activity header did
--    exactly that and reported 150 visitors where there were 90. The true
--    figure is carried on every row instead, so the caller reads it without a
--    second round trip.
--
-- 2. The function is SECURITY DEFINER over page_views, which has RLS on with no
--    policies. It was executable by PUBLIC, so the anon key that ships in the
--    public site bundle could read the whole traffic table -- every path
--    including the admin routes -- through the RPC. Only the two server-side
--    callers need it, and both use the service role.

drop function if exists public.page_impressions(timestamptz);

create function public.page_impressions(since timestamptz default null)
returns table (
  path text,
  total bigint,
  visitors bigint,
  bots bigint,
  admin_views bigint,
  is_admin boolean,
  last_seen timestamptz,
  site_visitors bigint
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
  ),
  site as (
    select count(distinct t.visitor_id) filter (where not t.is_bot)::bigint as visitors
    from tagged t
  )
  select
    t.path,
    count(*)::bigint                                                 as total,
    count(distinct t.visitor_id) filter (where not t.is_bot)::bigint as visitors,
    count(*) filter (where t.is_bot)::bigint                         as bots,
    count(*) filter (where t.is_admin)::bigint                       as admin_views,
    bool_or(t.is_admin)                                              as is_admin,
    max(t.occurred_at)                                               as last_seen,
    s.visitors                                                       as site_visitors
  from tagged t
  cross join site s
  group by t.path, s.visitors
  order by count(*) desc;
$$;

revoke all on function public.page_impressions(timestamptz) from public;
revoke all on function public.page_impressions(timestamptz) from anon;
revoke all on function public.page_impressions(timestamptz) from authenticated;
grant execute on function public.page_impressions(timestamptz) to service_role;
