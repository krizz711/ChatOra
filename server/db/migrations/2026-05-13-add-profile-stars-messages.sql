alter table users
  add column if not exists country text,
  add column if not exists state text,
  add column if not exists gender text default 'other',
  add column if not exists age integer,
  add column if not exists star_count integer not null default 0;

alter table users
  drop constraint if exists users_gender_check;

alter table users
  add constraint users_gender_check check (gender in ('female', 'male', 'other'));

alter table users
  drop constraint if exists users_age_check;

alter table users
  add constraint users_age_check check (age is null or age between 13 and 120);

create table if not exists messages (
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

create index if not exists idx_messages_room_created on messages(room_id, created_at desc);
create index if not exists idx_messages_sender on messages(sender_id);

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

update users
set star_count = coalesce(star_totals.total, 0)
from (
  select starred_user_id, count(*) as total
  from user_stars
  group by starred_user_id
) as star_totals
where users.id = star_totals.starred_user_id;

update users
set star_count = 0
where star_count is null;
