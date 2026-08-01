-- AI Call Trainer — security hardening (SEC-01)
--
-- 0001 shipped permissive policies (`for all using (true) with check (true)`) on
-- sessions/turns/evaluations, which made every row world-readable AND writable
-- to anyone holding the public anon key. The app no longer writes to these
-- tables at all: localStorage is the source of truth, and cross-device sync uses
-- `user_backups`, which is RLS-scoped to `auth.uid()` (see 0002).
--
-- This migration drops those permissive policies. RLS stays ENABLED with no anon
-- policy, which means the anon key is denied entirely; only the service role
-- (used by Edge Functions) can reach these tables — matching `usage_events`.
--
-- Safe to run on any project. If you later want server-side, multi-user
-- persistence of sessions, add a `user_id uuid default auth.uid()` column and
-- scope new policies to `auth.uid() = user_id` instead of re-opening them.

drop policy if exists anon_rw_sessions on sessions;
drop policy if exists anon_rw_turns on turns;
drop policy if exists anon_rw_evaluations on evaluations;

-- The seed catalog (products/personas/scenarios) holds only public demo content
-- and the app reads its catalog from the client seed, not from Postgres. The
-- read-only anon policies from 0001 are therefore harmless, but you may drop
-- them too for a fully locked database:
-- drop policy if exists anon_read_products on products;
-- drop policy if exists anon_read_personas on personas;
-- drop policy if exists anon_read_scenarios on scenarios;

-- Belt-and-suspenders to the client-side cap in cloudSync.ts: bound the synced
-- backup size at the database (guards cloud-storage abuse). Applied only if the
-- optional sync table from 0002 exists.
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'user_backups') then
    begin
      alter table user_backups
        add constraint user_backups_size check (pg_column_size(data) < 2000000);
    exception when duplicate_object then null;
    end;
  end if;
end $$;
