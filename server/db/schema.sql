-- ============================================================
-- CHAT APP - SUPABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── USERS ────────────────────────────────────────────────────
create table users (
  id uuid primary key default uuid_generate_v4(),
  username text unique not null,
  email text unique,
  password_hash text,
  avatar_url text,
  bio text default '',
  country text,
  state text,
  gender text default 'other' check (gender in ('female', 'male', 'other')),
  age integer check (age is null or age between 13 and 120),
  star_count integer not null default 0,
  google_id text unique,
  auth_provider text default 'email' check (auth_provider IN ('email', 'google', 'guest')),
  created_at timestamptz default now()
);

-- Index for fast Google ID lookup
create index if not exists idx_users_google_id on users(google_id);

-- ── GROUPS ───────────────────────────────────────────────────
create table groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_id uuid references users(id) on delete set null,
  is_private boolean default false,
  is_global boolean default false,
  invite_code text unique,
  created_at timestamptz default now()
);

-- ── GROUP MEMBERS ─────────────────────────────────────────────
create table group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- ── USER STARS (POPULAR CHATTER) ───────────────────────────────
create table user_stars (
  starred_by uuid references users(id) on delete cascade,
  starred_user_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (starred_by, starred_user_id),
  constraint no_self_star check (starred_by <> starred_user_id)
);

-- ── MESSAGES ──────────────────────────────────────────────────
create table messages (
  id uuid primary key,
  room_id uuid references groups(id) on delete cascade,
  sender_id uuid references users(id) on delete set null,
  text text default '',
  file_url text,
  file_name text,
  file_type text,
  file_size bigint,
  reply_to uuid references messages(id) on delete set null,
  created_at timestamptz default now()
);

-- ── INDEXES ───────────────────────────────────────────────────
create index idx_group_members_user on group_members(user_id);
create index idx_group_members_group on group_members(group_id);
create index idx_groups_global on groups(is_global);
create index idx_groups_invite on groups(invite_code);
create index idx_user_stars_target on user_stars(starred_user_id);
create index idx_messages_room_created on messages(room_id, created_at desc);
create index idx_messages_sender on messages(sender_id);

create or replace function sync_user_star_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update users set star_count = star_count + 1 where id = new.starred_user_id;
    return new;
  elsif tg_op = 'DELETE' then
    update users set star_count = greatest(star_count - 1, 0) where id = old.starred_user_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_user_stars_count_insert on user_stars;
create trigger trg_user_stars_count_insert
after insert on user_stars
for each row execute function sync_user_star_count();

drop trigger if exists trg_user_stars_count_delete on user_stars;
create trigger trg_user_stars_count_delete
after delete on user_stars
for each row execute function sync_user_star_count();

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table users enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table user_stars enable row level security;
alter table messages enable row level security;

-- Service role bypasses RLS (our server uses service role key)
-- These policies are for direct client access safety

create policy "Users can read all profiles"
  on users for select using (true);

create policy "Users can update own profile"
  on users for update using (auth.uid()::text = id::text);

create policy "Users can read messages"
  on messages for select using (true);

create policy "Users can manage own messages"
  on messages for all using (auth.uid()::text = sender_id::text)
  with check (auth.uid()::text = sender_id::text);

create policy "Anyone can read public groups"
  on groups for select using (is_private = false or is_global = true);

create policy "Members can read private groups"
  on groups for select using (
    exists (
      select 1 from group_members
      where group_id = groups.id and user_id::text = auth.uid()::text
    )
  );

create policy "Users can read stars"
  on user_stars for select using (true);

create policy "Users can manage own stars"
  on user_stars for all using (auth.uid()::text = starred_by::text)
  with check (auth.uid()::text = starred_by::text);

-- ── SEED: 4 GLOBAL ROOMS ─────────────────────────────────────
insert into groups (name, is_global, is_private) values
  ('🌍 General', true, false),
  ('🎮 Gaming', true, false),
  ('🎵 Music & Arts', true, false),
  ('💻 Tech Talk', true, false);

-- ============================================================
-- DONE. Your database is ready.
-- ============================================================
