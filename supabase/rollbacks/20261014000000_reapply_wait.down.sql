-- Undoes 20261014000000_reapply_wait.sql. Kept out of supabase/migrations so
-- `supabase db push` never runs it; paste it into the SQL editor if needed.
--
-- The policy goes back exactly as 20261012000000_restore_email_verified_gate.sql
-- left it. The three columns are dropped with their data: rejection dates and
-- any "Allow reapplying now" are lost. Roll the app code back first, since it
-- selects these columns.

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

drop function if exists public.reapply_wait_over(uuid);

alter table public.applications
  drop column if exists rejected_at,
  drop column if exists reapply_from,
  drop column if exists reapply_allowed_at;
