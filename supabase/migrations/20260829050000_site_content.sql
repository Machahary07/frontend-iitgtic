-- Editable site content.
--
-- One row per top-level section of content.json ('nav', 'homeHero',
-- 'pages.events', …). Keeping sections as separate rows rather than one big
-- document means two admins editing different pages never clobber each other,
-- and the audit trail records which section changed rather than "the site".
--
-- content.json stays in the repo as the fallback: anything not present here is
-- read from it, so an unseeded database still renders the site.

create table if not exists public.site_content (
  key         text primary key,
  value       jsonb not null,
  label       text not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

create trigger site_content_touch_updated_at
  before update on public.site_content
  for each row execute function public.touch_updated_at();

alter table public.site_content enable row level security;

-- Public pages read this on the server with the service role, so the anon role
-- needs nothing. Writes are admin-only, through /api/tic-admin/content.
revoke all on public.site_content from anon, authenticated;

drop trigger if exists audit_site_content on public.site_content;
create trigger audit_site_content
  after insert or update or delete on public.site_content
  for each row execute function public.audit_trigger();
