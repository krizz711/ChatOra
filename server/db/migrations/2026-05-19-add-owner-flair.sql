-- Add is_owner column to users table
alter table users
  add column if not exists is_owner boolean not null default false;

-- Set the owner flag for the founder account(s)
update users
set is_owner = true
where lower(trim(email)) in (
  'manualmax777@gmail.com',
  'munalmax777@gmail.com'
);
