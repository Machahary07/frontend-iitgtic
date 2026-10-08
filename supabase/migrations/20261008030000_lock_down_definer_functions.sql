-- SECURITY DEFINER helpers that were callable by anyone through /rest/v1/rpc.
--
--   rate_limit_hit / rate_limit_sweep  only the server's rate limiter calls these
--                                      (service role). Open, anyone could push a
--                                      stranger's counter over the limit and lock
--                                      them out, or flood the table.
--   is_admin / admin_count             told an anonymous caller whether an id is
--   company_member_ids                 an admin, how many admins exist, and which
--                                      user ids belong to a company. No access
--                                      rule or app code uses them.
--
-- my_company_ids and is_company_verified stay as they are: the row-level
-- policies on companies, jobs and applications call them as the signed-in user.

revoke execute on function public.rate_limit_hit(text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.rate_limit_sweep() from public, anon, authenticated;
revoke execute on function public.is_admin(uuid) from public, anon, authenticated;
revoke execute on function public.admin_count() from public, anon, authenticated;
revoke execute on function public.company_member_ids(uuid) from public, anon, authenticated;

grant execute on function public.rate_limit_hit(text, text, integer, integer) to service_role;
grant execute on function public.rate_limit_sweep() to service_role;
grant execute on function public.is_admin(uuid) to service_role;
grant execute on function public.admin_count() to service_role;
grant execute on function public.company_member_ids(uuid) to service_role;
