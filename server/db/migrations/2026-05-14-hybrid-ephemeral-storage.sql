-- Hybrid ephemeral storage model
-- - Room messages expire after 30 minutes by default.
-- - Private messages are stored for conversation continuity.

alter table messages
  add column if not exists expires_at timestamptz;

update messages
set expires_at = created_at + interval '30 minutes'
where expires_at is null;

create index if not exists idx_messages_room_expires_created
  on messages(room_id, expires_at, created_at desc);

create table if not exists private_messages (
  id uuid primary key,
  sender_key text not null,
  recipient_key text not null,
  sender_snapshot jsonb not null default '{}'::jsonb,
  recipient_snapshot jsonb not null default '{}'::jsonb,
  text text default '',
  file_url text,
  file_name text,
  file_type text,
  created_at timestamptz default now()
);

create index if not exists idx_private_messages_sender_created
  on private_messages(sender_key, created_at desc);

create index if not exists idx_private_messages_recipient_created
  on private_messages(recipient_key, created_at desc);

create index if not exists idx_private_messages_pair_created
  on private_messages(sender_key, recipient_key, created_at desc);

