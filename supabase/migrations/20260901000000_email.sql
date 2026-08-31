-- Transactional email: editable templates, and a log of everything sent.
--
-- Delivery goes through Resend. Two things are kept here rather than left to the
-- provider dashboard:
--
--   * `email_templates` — subject and HTML body per message, editable from the
--     console. content.json's pattern is reused: the bundled copy in
--     emailTemplates.ts is the fallback, a row here overrides it, and deleting
--     the row restores the default.
--
--   * `email_log` — one row per send attempt, holding the rendered subject and
--     body. Resend's own log neither shows a delivery that never left (a missing
--     API key, a quota block) nor lets the console preview the exact body a
--     given applicant received, so both are recorded on our side. This is also
--     what the usage meter counts against the plan allowance.

-- ---------------------------------------------------------------------------
-- email_templates
-- ---------------------------------------------------------------------------

create table if not exists public.email_templates (
  key         text primary key,
  subject     text not null,
  body        text not null,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

create trigger email_templates_touch_updated_at
  before update on public.email_templates
  for each row execute function public.touch_updated_at();

-- Name, description and the variable list live in code, not here: they describe
-- what the app passes to a template, so an admin editing copy must not be able
-- to drift them away from the call sites.
alter table public.email_templates enable row level security;
revoke all on public.email_templates from anon, authenticated;

drop trigger if exists audit_email_templates on public.email_templates;
create trigger audit_email_templates
  after insert or update or delete on public.email_templates
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- email_log
-- ---------------------------------------------------------------------------

-- status:
--   sent    — Resend accepted it and returned a message id
--   failed  — Resend rejected it, or the request never completed
--   blocked — never attempted: no API key configured, the template is switched
--             off, or the plan's daily/monthly allowance is already spent
create table if not exists public.email_log (
  id            uuid primary key default gen_random_uuid(),
  template_key  text not null default '',
  to_email      text not null,
  to_name       text not null default '',
  subject       text not null default '',
  body          text not null default '',
  status        text not null default 'sent'
                  check (status in ('sent', 'failed', 'blocked')),
  provider_id   text,
  error         text,
  is_test       boolean not null default false,
  context       jsonb not null default '{}'::jsonb,
  sent_by       uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists email_log_created_at_idx on public.email_log (created_at desc);
create index if not exists email_log_status_idx on public.email_log (status);
create index if not exists email_log_template_idx on public.email_log (template_key);

-- The usage meter counts sends inside the current month and the current day, so
-- both windows are served by this partial index rather than a sequential scan.
create index if not exists email_log_sent_at_idx
  on public.email_log (created_at desc)
  where status = 'sent';

-- Recipients never read this back, and the console reaches it through the
-- service role like every other admin surface. No audit trigger: the table is
-- already an append-only record, and the bodies would double the audit log.
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;
