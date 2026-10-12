-- 'returned': TIC has sent a submitted application back to its founder — to
-- confirm their email first, say. The founder reopens it with every answer and
-- upload kept and submits it again through /api/founder/application/resubmit,
-- which moves it back to 'submitted'.

alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications
  add constraint applications_status_check
  check (status in ('submitted', 'under-review', 'accepted', 'rejected', 'returned'));
