-- Founder email verification, as a flag we own rather than Supabase's native
-- confirmation.
--
-- Native confirmation withholds the session until the link is clicked, which
-- would stop a founder from even opening the application. We want the opposite:
-- let them sign up and fill the whole form, but hold the final submit until the
-- address is confirmed. So verification is a boolean here, set by the signed
-- /verify-email link, and the step-8 consent gate is what reads it.

alter table public.profiles
  add column if not exists email_verified boolean not null default false;

-- Everyone who already has an account predates this and has been in touch, so
-- treat them as verified rather than locking the whole cohort out of step 8 the
-- moment this lands. New signups get the column default (false) instead.
update public.profiles set email_verified = true where email_verified = false;

-- No grant change is needed: the authenticated update grant on this table is
-- column-scoped to (full_name, email, phone), so email_verified is already
-- writable by the service role alone. Founders can still read it (they need to,
-- for the gate) through the table-wide select grant.

-- Enforce the confirm-your-email gate at the row, not just in the UI: an
-- application can be inserted only from an account whose email is verified. The
-- step-8 consent boxes are the friendly version of this; the policy is what makes
-- it real, so calling the API directly cannot write an unverified application.
-- (Existing accounts were backfilled to verified above, so nobody in flight is
-- locked out.)
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
