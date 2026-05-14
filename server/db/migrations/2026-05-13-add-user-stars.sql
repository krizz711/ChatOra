-- Add persistent popularity stars
create table if not exists user_stars (
  starred_by uuid references users(id) on delete cascade,
  starred_user_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (starred_by, starred_user_id),
  constraint no_self_star check (starred_by <> starred_user_id)
);

create index if not exists idx_user_stars_target on user_stars(starred_user_id);

alter table user_stars enable row level security;

create policy "Users can read stars"
  on user_stars for select using (true);

create policy "Users can manage own stars"
  on user_stars for all using (auth.uid()::text = starred_by::text)
  with check (auth.uid()::text = starred_by::text);
