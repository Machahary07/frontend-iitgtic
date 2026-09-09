-- Saved assistant conversations.
--
-- The admin assistant used to keep nothing between chats — starting a new one
-- threw the last away. This stores each conversation so an admin can leave and
-- come back to it, and so the history panel and "New chat" have something to
-- work with. One row per conversation, the turns held as a JSON array, scoped
-- to the admin whose chat it was.
--
-- Not audited: these are an admin's own chats, not site data, and a row per
-- message would drown the audit log. RLS is on with no policies — the table is
-- reached only through /api/tic-admin/ai/conversations with the service role,
-- the same as the console's other private tables.

create table if not exists public.assistant_conversations (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references auth.users (id) on delete cascade,
  title       text not null default 'New chat',
  messages    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The history panel lists an admin's own conversations, newest first.
create index if not exists assistant_conversations_admin_idx
  on public.assistant_conversations (admin_id, updated_at desc);

create trigger assistant_conversations_touch_updated_at
  before update on public.assistant_conversations
  for each row execute function public.touch_updated_at();

alter table public.assistant_conversations enable row level security;

-- Service-role only, reached through /api/tic-admin/ai/conversations.
revoke all on public.assistant_conversations from anon, authenticated;
