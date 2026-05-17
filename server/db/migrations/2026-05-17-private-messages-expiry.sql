alter table private_messages
  add column if not exists expires_at timestamptz
    generated always as (created_at + interval '30 days') stored;

create index if not exists idx_private_messages_expires
  on private_messages(expires_at);

create or replace function delete_expired_private_messages()
returns void
language plpgsql
as $$
begin
  delete from private_messages
  where expires_at < now();
end;
$$;