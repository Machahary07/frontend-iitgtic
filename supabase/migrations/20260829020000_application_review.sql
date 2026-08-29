-- Applications were write-only: a founder could submit, but nothing read them back.
-- This adds the reviewer's side of the record. Both columns are service-role only —
-- they are not in the grants below, so an applicant cannot move their own
-- application through review or write the reviewer's note.

alter table public.applications
  add column if not exists review_note text,
  add column if not exists reviewed_at timestamptz;

-- Re-state the applicant grants so the new columns are excluded explicitly.
revoke all on public.applications from anon, authenticated;
grant select on public.applications to authenticated;
grant insert (user_id, full_name, email, startup_name, answers, documents) on public.applications to authenticated;
grant update (full_name, email, startup_name, answers, documents) on public.applications to authenticated;

create index if not exists applications_created_at_idx on public.applications (created_at desc);
