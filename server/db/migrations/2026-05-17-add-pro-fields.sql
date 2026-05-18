alter table users add column if not exists is_pro boolean default false;
alter table users add column if not exists stripe_customer_id text;
