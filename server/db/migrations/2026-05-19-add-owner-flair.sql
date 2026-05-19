-- Add is_owner column to users table
alter table users
  add column if not exists is_owner boolean not null default false;

-- Set the owner flag for the specific email
update users
set is_owner = true
where email = 'maxmunal777@gmail.com' or email = 'maxmunal777@gmail.com';
