-- Multiple profile flairs (user-picked badges)
alter table users
  add column if not exists flairs text[] not null default '{}';

-- Migrate legacy single flair column if present
update users
set flairs = array[flair]::text[]
where flair is not null
  and trim(flair) <> ''
  and (flairs is null or flairs = '{}');
