alter table users
  add column if not exists calls_enabled boolean not null default true,
  add column if not exists notification_sound boolean not null default true;