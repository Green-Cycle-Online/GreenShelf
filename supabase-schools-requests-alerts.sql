-- GreenShelf: schools list, reading books, wanted board, alerts + notifications
--
-- APPLY IN SUPABASE DASHBOARD: paste this whole file into the SQL Editor and run it.
-- Idempotent: safe to run more than once. Additive only: no existing column is
-- dropped or renamed, so the live website and the shipped app keep working.
-- This file supersedes the earlier draft supabase-book-requests.sql.
--
-- What it adds:
--   schools            admin-managed list every client reads for the school dropdown
--                      and filter. Public read of active rows; admin-only writes.
--   listings.category  'school' (default) or 'reading'. Reading books store their
--                      genre in `subject` and an age band in `grade_level`, so every
--                      existing query, filter and card keeps working.
--   listings.school_id optional FK to schools. The old free-text `school` column
--                      stays and is kept in sync by the clients for older builds.
--   book_requests      the "wanted" board (a family posts a book they need).
--   request_responses  "I have this" replies; contact flows only through these.
--   book_alerts        a saved search per user (category / school / grade / subject / area).
--   notifications      in-app inbox rows, written ONLY by triggers when a new listing
--                      matches an alert, or someone responds to a request.
--
-- Plain hyphens only, no em/en dashes anywhere.

begin;

-- ---------------------------------------------------------------------------
-- 0. Admin helper (same definition as supabase-security-policies.sql).
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
-- 1. SCHOOLS
-- ===========================================================================
create table if not exists public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  area        text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists schools_active_idx on public.schools (is_active, sort_order, name);

alter table public.schools enable row level security;

drop policy if exists schools_select_active_or_admin on public.schools;
create policy schools_select_active_or_admin
  on public.schools for select
  to anon, authenticated
  using (is_active = true or public.is_admin());

drop policy if exists schools_insert_admin on public.schools;
create policy schools_insert_admin
  on public.schools for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists schools_update_admin on public.schools;
create policy schools_update_admin
  on public.schools for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists schools_delete_admin on public.schools;
create policy schools_delete_admin
  on public.schools for delete
  to authenticated
  using (public.is_admin());

-- Starter list: the schools already named on real listings, plus well-known
-- Muscat schools. Admins can rename, hide, or add more from the dashboard.
insert into public.schools (name, area) values
  ('Indian School Bausher', 'Bausher'),
  ('Indian School Al Ghubra', 'Ghubra'),
  ('Indian School Muscat', 'Ruwi'),
  ('Indian School Wadi Kabir', 'Wadi Kabir'),
  ('Indian School Darsait', 'Darsait'),
  ('Indian School Al Seeb', 'Seeb'),
  ('Indian School Al Maabela', 'Al Mabela'),
  ('ABA Oman International School', 'Madinat Qaboos'),
  ('British School Muscat', 'Madinat Qaboos'),
  ('The American International School Muscat', 'Bausher'),
  ('Muscat International School', 'Al Khuwair'),
  ('The Sultan''s School', 'Seeb'),
  ('Al Sahwa Schools', 'Al Hail'),
  ('Pakistan School Muscat', 'Ruwi'),
  ('Sri Lankan School Muscat', 'Ghubra'),
  ('Azzan Bin Qais International School', 'Seeb')
on conflict (name) do nothing;

-- ===========================================================================
-- 2. LISTINGS: category + school link
-- ===========================================================================
alter table public.listings add column if not exists category text not null default 'school';
alter table public.listings add column if not exists school_id uuid references public.schools (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'listings_category_check'
  ) then
    alter table public.listings
      add constraint listings_category_check check (category in ('school', 'reading'));
  end if;
end $$;

create index if not exists listings_category_idx on public.listings (category, status, created_at desc);
create index if not exists listings_school_idx   on public.listings (school_id);

-- ===========================================================================
-- 3. BOOK REQUESTS (wanted board)
-- ===========================================================================
create table if not exists public.book_requests (
  id             uuid primary key default gen_random_uuid(),
  requester_id   uuid not null references auth.users (id) on delete cascade,
  requester_name text not null,
  title          text not null,
  category       text not null default 'school',
  subject        text,
  grade_level    text,
  area           text,
  school_id      uuid references public.schools (id) on delete set null,
  school         text,
  note           text,
  status         text not null default 'open',   -- 'open' | 'fulfilled'
  created_at     timestamptz not null default now()
);

create index if not exists book_requests_created_idx   on public.book_requests (status, created_at desc);
create index if not exists book_requests_requester_idx on public.book_requests (requester_id);

alter table public.book_requests enable row level security;

-- Read: anyone (the board is browsable like the listings feed).
drop policy if exists requests_select_all on public.book_requests;
create policy requests_select_all
  on public.book_requests for select
  to anon, authenticated
  using (true);

drop policy if exists requests_insert_self on public.book_requests;
create policy requests_insert_self
  on public.book_requests for insert
  to authenticated
  with check (requester_id = auth.uid());

drop policy if exists requests_update_self_or_admin on public.book_requests;
create policy requests_update_self_or_admin
  on public.book_requests for update
  to authenticated
  using (requester_id = auth.uid() or public.is_admin())
  with check (requester_id = auth.uid() or public.is_admin());

drop policy if exists requests_delete_self_or_admin on public.book_requests;
create policy requests_delete_self_or_admin
  on public.book_requests for delete
  to authenticated
  using (requester_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- request_responses: "I have this book" replies. Contact details live ONLY
-- here, visible to the requester and the responder.
-- ---------------------------------------------------------------------------
create table if not exists public.request_responses (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.book_requests (id) on delete cascade,
  responder_id   uuid not null references auth.users (id) on delete cascade,
  responder_name text not null,
  contact_method text,                 -- 'whatsapp' | 'phone' | 'email'
  contact_value  text,
  message        text,
  listing_id     uuid references public.listings (id) on delete set null,
  read_at        timestamptz,
  created_at     timestamptz not null default now(),
  unique (request_id, responder_id)
);

create index if not exists request_responses_request_idx   on public.request_responses (request_id);
create index if not exists request_responses_responder_idx on public.request_responses (responder_id);

alter table public.request_responses enable row level security;

drop policy if exists responses_select_party on public.request_responses;
create policy responses_select_party
  on public.request_responses for select
  to authenticated
  using (
    responder_id = auth.uid()
    or request_id in (select id from public.book_requests where requester_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists responses_insert_self on public.request_responses;
create policy responses_insert_self
  on public.request_responses for insert
  to authenticated
  with check (responder_id = auth.uid());

drop policy if exists responses_update_requester on public.request_responses;
create policy responses_update_requester
  on public.request_responses for update
  to authenticated
  using (request_id in (select id from public.book_requests where requester_id = auth.uid()))
  with check (request_id in (select id from public.book_requests where requester_id = auth.uid()));

drop policy if exists responses_delete_party on public.request_responses;
create policy responses_delete_party
  on public.request_responses for delete
  to authenticated
  using (
    responder_id = auth.uid()
    or request_id in (select id from public.book_requests where requester_id = auth.uid())
    or public.is_admin()
  );

-- ===========================================================================
-- 4. BOOK ALERTS (saved searches)
-- ===========================================================================
create table if not exists public.book_alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  category     text not null default 'school',
  school_id    uuid references public.schools (id) on delete cascade,
  grade_level  text,
  subject      text,
  area         text,
  created_at   timestamptz not null default now()
);

create index if not exists book_alerts_user_idx on public.book_alerts (user_id);
create index if not exists book_alerts_match_idx on public.book_alerts (category, school_id, grade_level, subject, area);

alter table public.book_alerts enable row level security;

drop policy if exists alerts_select_self on public.book_alerts;
create policy alerts_select_self
  on public.book_alerts for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists alerts_insert_self on public.book_alerts;
create policy alerts_insert_self
  on public.book_alerts for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists alerts_delete_self on public.book_alerts;
create policy alerts_delete_self
  on public.book_alerts for delete
  to authenticated
  using (user_id = auth.uid());

-- ===========================================================================
-- 5. NOTIFICATIONS (in-app inbox). Written only by the triggers below.
-- ===========================================================================
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null,                      -- 'listing_match' | 'request_response'
  listing_id  uuid references public.listings (id) on delete cascade,
  request_id  uuid references public.book_requests (id) on delete cascade,
  alert_id    uuid references public.book_alerts (id) on delete cascade,
  title       text not null,
  body        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

-- A user may only flip read_at on their own rows: column-level grant, same
-- pattern as profiles.is_admin protection.
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke update on table public.notifications from anon, authenticated;
grant update (read_at) on table public.notifications to authenticated;

drop policy if exists notifications_delete_self on public.notifications;
create policy notifications_delete_self
  on public.notifications for delete
  to authenticated
  using (user_id = auth.uid());

-- No insert policy on purpose: clients cannot forge notifications. The trigger
-- functions are SECURITY DEFINER and write on the user's behalf.

-- ---------------------------------------------------------------------------
-- Trigger: new listing -> notify every matching alert (never the poster).
-- ---------------------------------------------------------------------------
create or replace function public.notify_matching_alerts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'available' then
    return new;
  end if;
  insert into public.notifications (user_id, kind, listing_id, alert_id, title, body)
  select
    a.user_id,
    'listing_match',
    new.id,
    a.id,
    'New book: ' || new.title,
    concat_ws(' · ', nullif(new.grade_level, ''), nullif(new.subject, ''), nullif(new.area, ''))
  from public.book_alerts a
  where a.user_id is distinct from new.owner_id
    and a.category = new.category
    and (a.school_id is null or a.school_id = new.school_id)
    and (a.grade_level is null or a.grade_level = new.grade_level)
    and (a.subject is null or lower(a.subject) = lower(coalesce(new.subject, '')))
    and (a.area is null or a.area = new.area);
  return new;
end;
$$;

drop trigger if exists listings_notify_alerts on public.listings;
create trigger listings_notify_alerts
  after insert on public.listings
  for each row execute function public.notify_matching_alerts();

-- ---------------------------------------------------------------------------
-- Trigger: someone responds "I have this" -> notify the requester.
-- ---------------------------------------------------------------------------
create or replace function public.notify_request_response()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.book_requests%rowtype;
begin
  select * into r from public.book_requests where id = new.request_id;
  if r.id is null or r.requester_id = new.responder_id then
    return new;
  end if;
  insert into public.notifications (user_id, kind, request_id, title, body)
  values (
    r.requester_id,
    'request_response',
    new.request_id,
    new.responder_name || ' has "' || r.title || '"',
    'Open your request to see their contact details.'
  );
  return new;
end;
$$;

drop trigger if exists request_responses_notify on public.request_responses;
create trigger request_responses_notify
  after insert on public.request_responses
  for each row execute function public.notify_request_response();

commit;
