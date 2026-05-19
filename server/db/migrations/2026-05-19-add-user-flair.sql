-- Profile flair chosen by the user (optional cosmetic badge)
alter table users
  add column if not exists flair text;
