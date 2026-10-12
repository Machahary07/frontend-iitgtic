-- Put the confirm-your-email condition back on the application insert policy.
--
-- 20260910000000_founder_email_verified.sql added it; 20260912000000_founder_console.sql
-- then dropped and recreated "applications: insert own" with only the owner
-- check, so from then on an unverified account could submit. Same policy as
-- founder_console, plus the email_verified condition.

drop policy if exists "applications: insert own" on public.applications;
create policy "applications: insert own"
  on public.applications for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.email_verified
    )
  );
