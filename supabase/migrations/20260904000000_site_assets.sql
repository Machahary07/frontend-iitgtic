-- Images uploaded for the public site from the content editor.
--
-- Public for the same reason email-assets is: a visitor's browser fetches an
-- <img> with no cookies and no Authorization header, and a signed URL would go
-- stale inside content that is already published. Nothing here is private —
-- every object in this bucket is something an admin deliberately put on a page.
--
-- Writing is admin-only: uploads go through /api/tic-admin/content/assets with
-- the service role, so the bucket holds only what the console published.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Reading is what "public" already grants. No insert/update/delete policies, so
-- anon and authenticated cannot write: the console's service-role route is the
-- only way anything lands here. Same model as email-assets.
