-- GreenShelf backend security policies (idempotent)
-- Generated 2026-07-10 security hardening pass.
--
-- APPLY IN SUPABASE DASHBOARD: paste this whole file into the SQL Editor and run it.
-- It is safe to run more than once. It (re)creates every policy by name, so it
-- overwrites any drifted or overly broad policy with the correct one.
--
-- What this enforces, assuming an attacker who holds the public anon key and hits
-- the REST / Realtime endpoints directly (not just through the UI):
--   listings      public reads available/claimed only; writes require auth; a user
--                 can only change or delete their own rows; admins can moderate.
--   profiles      a user reads/updates only their own row; nobody but an admin can
--                 read anyone else's (emails/schools stay private); is_admin cannot
--                 be self-granted (column-level privilege).
--   reports       any signed-in user can file one for themselves; only admins read
--                 or change them.
--   site_settings anyone may read (homepage counter); only admins may write.
--   book-photos   public read; only signed-in users may upload/change/delete, and
--                 only inside a folder named after their own user id.
--
-- Plain hyphens only, no em/en dashes anywhere.

begin;

-- ---------------------------------------------------------------------------
-- 0. Admin check helper.
-- SECURITY DEFINER so a policy on any table can ask "is the caller an admin?"
-- without the caller needing read access to the profiles table, and without
-- risking recursive RLS evaluation. Locked search_path to prevent hijacking.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ===========================================================================
-- 1. LISTINGS
-- ===========================================================================
alter table public.listings enable row level security;

-- Public read: only status the product treats as public (available or claimed).
-- Owners always see their own rows (any status); admins see everything. This is
-- deliberately tighter than USING (true): if you ever add a 'pending' or 'hidden'
-- status it will NOT leak to anonymous visitors.
drop policy if exists listings_select_public on public.listings;
create policy listings_select_public
  on public.listings for select
  using (
    status in ('available', 'claimed')
    or owner_id = auth.uid()
    or public.is_admin()
  );

-- Insert: signed-in only, and the DB refuses a spoofed owner_id. The client sends
-- owner_id, but WITH CHECK forces it to equal the caller.
drop policy if exists listings_insert_own on public.listings;
create policy listings_insert_own
  on public.listings for insert
  to authenticated
  with check (owner_id = auth.uid());

-- Update: owner or admin. Covers edit, mark claimed, mark available. WITH CHECK
-- stops an owner from reassigning a row to someone else.
drop policy if exists listings_update_own_or_admin on public.listings;
create policy listings_update_own_or_admin
  on public.listings for update
  to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Delete: owner or admin (the admin dashboard deletes any listing by id).
drop policy if exists listings_delete_own_or_admin on public.listings;
create policy listings_delete_own_or_admin
  on public.listings for delete
  to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- ===========================================================================
-- 2. PROFILES
-- ===========================================================================
alter table public.profiles enable row level security;

-- Read: your own row only, or any row if you are an admin. Anonymous visitors get
-- nothing, so emails and school names never leak. The browse feed does not need
-- this table: owner_name is denormalised onto each listing.
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- Insert: a signed-in user may create only their own row (id = their uid). The
-- sign-up trigger, which runs as definer, is unaffected by this.
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- Update: your own row only.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- P0: is_admin must not be self-settable. RLS alone cannot stop a crafted request
-- that rides the UPDATE policy and flips is_admin on the caller's own row, because
-- id = auth.uid() is still true. Column-level privilege is the real fix: strip the
-- table-wide UPDATE grant and hand back only the three user-editable columns.
revoke update on table public.profiles from anon, authenticated;
grant update (full_name, school, grade_level) on table public.profiles to authenticated;

-- ===========================================================================
-- 3. REPORTS
-- ===========================================================================
alter table public.reports enable row level security;

-- Insert: signed-in users only, and reporter_id must be the caller (no spoofing
-- a report as someone else).
drop policy if exists reports_insert_self on public.reports;
create policy reports_insert_self
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

-- Read: admins only. Report contents (who flagged what) are moderation data.
drop policy if exists reports_select_admin on public.reports;
create policy reports_select_admin
  on public.reports for select
  using (public.is_admin());

-- Update: admins only (dismiss / triage).
drop policy if exists reports_update_admin on public.reports;
create policy reports_update_admin
  on public.reports for update
  using (public.is_admin())
  with check (public.is_admin());

-- Delete: admins only.
drop policy if exists reports_delete_admin on public.reports;
create policy reports_delete_admin
  on public.reports for delete
  using (public.is_admin());

-- ===========================================================================
-- 4. SITE_SETTINGS
-- ===========================================================================
alter table public.site_settings enable row level security;

-- Read: public. The homepage reads show_live_counter as an anonymous visitor.
drop policy if exists site_settings_select_public on public.site_settings;
create policy site_settings_select_public
  on public.site_settings for select
  using (true);

-- Write: admins only. The admin toggle upserts, so both INSERT and UPDATE are gated.
drop policy if exists site_settings_insert_admin on public.site_settings;
create policy site_settings_insert_admin
  on public.site_settings for insert
  with check (public.is_admin());

drop policy if exists site_settings_update_admin on public.site_settings;
create policy site_settings_update_admin
  on public.site_settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- ===========================================================================
-- 5. STORAGE: book-photos bucket
-- ===========================================================================
-- Bucket-level guards (MIME whitelist + size cap). The client already enforces
-- both, but the bucket must too, or a raw anon-key call can ignore the client.
-- SVG is intentionally absent (it can carry scripts). heic/heif are included
-- because the native app uploads those straight from the iOS camera roll.
update storage.buckets
  set public = true,
      file_size_limit = 5242880,  -- 5 MB
      allowed_mime_types = array[
        'image/jpeg', 'image/png', 'image/webp',
        'image/gif', 'image/heic', 'image/heif'
      ]
  where id = 'book-photos';

-- Read: public (photos are meant to be seen by everyone browsing).
drop policy if exists book_photos_read_public on storage.objects;
create policy book_photos_read_public
  on storage.objects for select
  using (bucket_id = 'book-photos');

-- Upload: signed-in only, and the first path segment must be the caller's uid.
-- This is what stops user A from writing into user B's folder, and stops an
-- anonymous anon-key holder from uploading anything at all.
drop policy if exists book_photos_insert_own on storage.objects;
create policy book_photos_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'book-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update: same owner-prefix rule.
drop policy if exists book_photos_update_own on storage.objects;
create policy book_photos_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'book-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'book-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: same owner-prefix rule.
drop policy if exists book_photos_delete_own on storage.objects;
create policy book_photos_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'book-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;

-- ===========================================================================
-- OPTIONAL, NOT APPLIED HERE: reduce contact-info scraping.
-- ===========================================================================
-- Anyone with the anon key can run
--     select contact_method, contact_value from listings
-- and harvest every lister's phone / WhatsApp / email in one request. That is
-- inherent to putting contact details on a publicly readable row, and RLS cannot
-- hide one column from anonymous readers while still letting them browse.
--
-- If you decide the scraping risk outweighs the friction, the minimum-viable fix
-- that KEEPS no-account browsing is: stop returning contact columns to anon, and
-- reveal them only to signed-in users through a function. Sketch (review before
-- running; it requires matching client changes so the contact link still works):
--
--   -- 1. A public view without the contact columns, for anonymous browse.
--   -- 2. revoke select on the raw contact columns from anon.
--   -- 3. A security-definer RPC get_contact(listing_id uuid) that returns the
--   --    contact only to auth.uid() is not null, so browsing stays anonymous but
--   --    seeing a number requires a (free) account.
--
-- This is a product decision, so it is left out of the block above on purpose.
