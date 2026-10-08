-- A note left behind when a founder closes their own account. The auth user and
-- profile are gone by then, so this is the only trace the Users page has of who
-- it was. Plain columns rather than a foreign key: there is nothing left to
-- point at. An admin can clear a row once it has been seen.

create table if not exists public.deleted_accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  email       text not null default '',
  full_name   text not null default '',
  role        text not null default 'founder',
  companies   text[] not null default '{}',
  joined_at   timestamptz,
  deleted_at  timestamptz not null default now()
);

create index if not exists deleted_accounts_deleted_at_idx
  on public.deleted_accounts (deleted_at desc);

-- Service role only: written by /api/account, read and cleared by the console.
alter table public.deleted_accounts enable row level security;
revoke all on public.deleted_accounts from anon, authenticated;

drop trigger if exists audit_deleted_accounts on public.deleted_accounts;
create trigger audit_deleted_accounts
  after insert or update or delete on public.deleted_accounts
  for each row execute function public.audit_trigger();
