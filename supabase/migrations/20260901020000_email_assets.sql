-- Pictures and documents used inside an email.
--
-- Public, unlike every other bucket here. An email client fetches an <img> with
-- no cookies and no Authorization header, so anything shown inside a message has
-- to be reachable without credentials — a signed URL would break the moment it
-- expired, in an email that had already been delivered. Only admins can put
-- anything in (uploads go through /api/tic-admin/email/assets with the service
-- role), so the bucket holds only what the console deliberately published.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'email-assets',
  'email-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'text/csv']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Reading is what "public" already grants. No insert/update/delete policies, so
-- anon and authenticated cannot write: the console's service-role route is the
-- only way anything lands here.
