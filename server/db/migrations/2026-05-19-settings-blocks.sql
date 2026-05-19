-- User privacy & settings
alter table users
  add column if not exists friends_list_hidden boolean not null default false;

-- Blocked users
create table if not exists user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

create index if not exists idx_user_blocks_blocker on user_blocks(blocker_id);
