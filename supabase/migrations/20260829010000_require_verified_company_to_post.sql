-- Posting was gated in the UI only: the "jobs: insert own" policy checked that the
-- row belonged to the caller, but not that the caller's company had been verified,
-- so a pending or rejected account could insert straight through PostgREST.
--
-- Insert and update now require a verified company. Select and delete stay as they
-- were, so a company that loses its verification can still see and retire the roles
-- it already posted.

drop policy if exists "jobs: insert own" on public.jobs;
create policy "jobs: insert own"
  on public.jobs for insert to authenticated
  with check (company_id = auth.uid() and public.is_company_verified(company_id));

drop policy if exists "jobs: update own" on public.jobs;
create policy "jobs: update own"
  on public.jobs for update to authenticated
  using (company_id = auth.uid() and public.is_company_verified(company_id))
  with check (company_id = auth.uid() and public.is_company_verified(company_id));
