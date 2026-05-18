alter table private_messages
  add column if not exists ciphertext text;

alter table private_messages
  add column if not exists nonce text;

create index if not exists idx_private_messages_ciphertext
  on private_messages(ciphertext);
