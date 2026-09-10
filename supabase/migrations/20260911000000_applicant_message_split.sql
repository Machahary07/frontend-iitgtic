-- Split the reviewer's note into two fields.
--
--   applicant_message — the line meant for the applicant: emailed on a decision
--                       and shown on their /account. Founder-readable.
--   review_note       — the team's own note. From here on it is service-role
--                       only, so a founder cannot read it through the API.
--
-- Until now a single review_note did both jobs — it was emailed to the applicant
-- and left readable by the founder through the table-wide select grant — so a
-- note a reviewer meant as internal was in fact reachable. This separates them.

alter table public.applications
  add column if not exists applicant_message text;

-- Existing notes were already applicant-facing (emailed on the decision), so
-- carry them across; founders keep seeing what they were shown before.
update public.applications
  set applicant_message = review_note
  where applicant_message is null and review_note is not null;

-- Take review_note out of the applicant's reach: replace the table-wide select
-- grant with a column-level one listing every column except review_note. Same
-- shape as the job_applications column grant that holds its own review_note back.
revoke select on public.applications from authenticated;
grant select (
  id, user_id, status, full_name, email, startup_name,
  answers, documents, created_at, updated_at, reviewed_at, applicant_message
) on public.applications to authenticated;
