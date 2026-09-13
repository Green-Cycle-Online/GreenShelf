-- GreenShelf: user blocking + moderation (App Store Guideline 1.2)
--
-- Apply this in the Supabase dashboard SQL editor once. It is additive and safe
-- to re-run (idempotent): it only creates the blocked_users table and its RLS.
--
-- What it enforces, assuming an attacker holding the public anon key:
--   blocked_users  a signed-in user can only create, read, and delete their OWN
--                  block rows (blocker_id must be the caller). Nobody can see who
--                  blocked whom except the blocker themselves.
--
-- Blocking in the app also inserts a row into public.reports (reason
-- 'inappropriate') so every block surfaces in the admin moderation queue. That
-- uses the existing reports_insert_self policy, so no change to reports is needed.

create table if not exists public.blocked_users (
  id           uuid primary key default gen_random_uuid(),
  blocker_id   uuid not null references auth.users (id) on delete cascade,
  blocked_id   uuid not null references auth.users (id) on delete cascade,
  blocked_name text,
  created_at   timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

create index if not exists blocked_users_blocker_idx on public.blocked_users (blocker_id);

alter table public.blocked_users enable row level security;

-- Insert: signed-in users only, and blocker_id must be the caller (no blocking on
-- someone else's behalf).
drop policy if exists blocked_insert_self on public.blocked_users;
create policy blocked_insert_self
  on public.blocked_users for insert
  to authenticated
  with check (blocker_id = auth.uid());

-- Read: you can only see the rows you created.
drop policy if exists blocked_select_self on public.blocked_users;
create policy blocked_select_self
  on public.blocked_users for select
  to authenticated
  using (blocker_id = auth.uid());

-- Delete (unblock): only your own rows.
drop policy if exists blocked_delete_self on public.blocked_users;
create policy blocked_delete_self
  on public.blocked_users for delete
  to authenticated
  using (blocker_id = auth.uid());
