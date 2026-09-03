-- The footer newsletter form.
--
-- It has always called preventDefault() and then shown "Thanks — we'll be in
-- touch." That message was not true: nothing was stored, nothing was sent, and
-- nobody was ever in touch. A form that lies about succeeding is worse than one
-- that is visibly not wired up, so this gives it somewhere to write.
--
-- Service-role only, like every other table a visitor writes to without an
-- account: the insert goes through /api/newsletter, which rate limits and
-- validates first.

create table if not exists public.newsletter_subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  source          text not null default 'footer',
  unsubscribed_at timestamptz,
  created_at      timestamptz not null default now()
);

-- One row per address, case-folded — Ada@x and ada@x are the same inbox. The
-- submit route turns the resulting unique violation into a plain success, so a
-- second subscribe is idempotent rather than an error, and the form cannot be
-- used to discover who is already on the list.
create unique index if not exists newsletter_subscribers_email_idx
  on public.newsletter_subscribers (lower(email));

create index if not exists newsletter_subscribers_created_at_idx
  on public.newsletter_subscribers (created_at desc);

alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon, authenticated;

-- Audited: a subscriber list is personal data, and who removed someone from it
-- is worth being able to answer.
drop trigger if exists audit_newsletter_subscribers on public.newsletter_subscribers;
create trigger audit_newsletter_subscribers
  after insert or update or delete on public.newsletter_subscribers
  for each row execute function public.audit_trigger();
