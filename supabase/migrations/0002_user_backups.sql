-- AI Call Trainer — cross-device sync (additive, opt-in)
--
-- One JSON blob per authenticated user holding their whole training backup
-- (the same shape as the local "export backup" file). This is deliberately
-- decoupled from the sessions/turns/evaluations tables: sync is optional, and
-- a user who never signs in is completely unaffected. localStorage stays the
-- source of truth on each device; this table is just the bridge between them.
--
-- Safe to run on an existing project — it only ADDS a table and its policies,
-- and never touches 0001_init.sql's tables.

create table if not exists user_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table user_backups enable row level security;

-- Each row is private to its owner. auth.uid() is the id of the signed-in
-- user; a client with only the anon key can never read or write another
-- user's backup.
create policy user_backups_select on user_backups
  for select using (auth.uid() = user_id);

create policy user_backups_insert on user_backups
  for insert with check (auth.uid() = user_id);

create policy user_backups_update on user_backups
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy user_backups_delete on user_backups
  for delete using (auth.uid() = user_id);
