# GreenShelf: Supabase / backend security checklist

Everything on this list can only be done by you, in the Supabase dashboard (or your DNS/host).
The client code is now hardened, but every client-side guard can be bypassed by anyone opening
devtools: the site exposes its client as `window.supabase` and the anon key is public by design.
**RLS is the only real enforcement.** Work top to bottom; the P0 items are the ones that can
actually hurt you.

Project: `wvladknkebqiqutboohw.supabase.co`
Tables in use: `listings`, `profiles`, `reports`, `site_settings`. Storage bucket: `book-photos`.

---

## P0-1. profiles.is_admin must not be self-settable

The ONLY thing that makes someone an admin is the `is_admin` boolean on their own `profiles` row.
The app writes only `full_name`, `school`, `grade_level`, but a crafted request can ride the same
UPDATE policy:

```js
// Run this in the browser console on your live site while signed in as a NORMAL user.
// It MUST fail or silently not change is_admin:
const { data, error } = await window.supabase
  .from('profiles').update({ is_admin: true }).eq('id', (await window.supabase.auth.getUser()).data.user.id).select()
console.log(data, error)
```

If that succeeds, fix it in SQL Editor (choose one):

```sql
-- Option A (recommended): column-level privilege. Users can update their profile
-- but never the is_admin column.
revoke update on table public.profiles from authenticated;
grant update (full_name, school, grade_level) on table public.profiles to authenticated;
```

## P0-2. listings: who can write what

Verify in Authentication > Policies for `listings`:

- INSERT: authenticated only, and WITH CHECK `owner_id = auth.uid()` (the client sends owner_id,
  the DB must refuse a spoofed one).
- UPDATE: `owner_id = auth.uid()` (or admin, see P0-4). This covers edit, claim, un-claim.
- DELETE: `owner_id = auth.uid()` (or admin).
- SELECT for anon: decide deliberately. The app filters to `status = 'available'` in the UI, but
  the detail fetch (`.eq('id', id)`) has no status filter, and anyone can query the table directly
  with the anon key. If you ever want hidden or paused listings, the SELECT policy must exclude
  them; today the app only uses statuses `available` and `claimed`.

Console probe (signed out, on your live site): this should return ONLY what you consider public:

```js
console.log(await window.supabase.from('listings').select('*').limit(100))
```

## P0-3. Heads up: there is NO moderation queue

Listings go live the moment they are posted (status `available`, no pending/approval state exists
in the app or, presumably, the DB). Combined with no-account browsing, spam will appear instantly
to everyone. Options, in increasing effort:
1. Accept it and rely on the report button (current state).
2. Add a `pending` status + admin approval before `available` (needs a DB default change, an RLS
   SELECT filter, and a small admin approve button; I can build the client side any time).

## P0-4. reports and admin operations

- `reports` INSERT: authenticated users only. SELECT and UPDATE: admins only
  (`exists (select 1 from profiles where id = auth.uid() and is_admin)`).
- Admin-only listing DELETE: the admin UI deletes any listing by id. RLS must allow DELETE for
  admins beyond the owner rule, and for nobody else.
- `site_settings`: SELECT public (the homepage reads `show_live_counter` as anon), INSERT and
  UPDATE admins only.

Probe as a normal signed-in user (both should fail):

```js
console.log(await window.supabase.from('reports').select('*').limit(1))
console.log(await window.supabase.from('site_settings').upsert({ key: 'show_live_counter', value: false }, { onConflict: 'key' }))
```

## P0-5. profiles: read exposure

The app only ever reads the user's own row. Verify anon/other users cannot SELECT other
profiles (emails and school names live there). Probe signed out:

```js
console.log(await window.supabase.from('profiles').select('*').limit(5))  // expect 0 rows or error
```

The built-in admin health check shows row counts per table; as a non-admin, the profiles count
should be at most 1.

## P1-6. Storage bucket book-photos

In Storage > book-photos > Policies:
- INSERT: authenticated only, and path must start with the uploader's uid:
  `(storage.foldername(name))[1] = auth.uid()::text`
- UPDATE/DELETE: same owner-prefix rule (today the client never deletes photos, so deleted
  listings orphan their images; consider a periodic manual cleanup).
- Public read is fine (photos are meant to be public).
- In bucket settings, set allowed MIME types to `image/jpeg, image/png, image/webp, image/gif`
  and a 5 MB size cap. The client enforces both now, but the bucket must too.

## P1-7. Auth settings (Authentication > Settings)

- Redirect URLs: the app uses `window.location.origin` for email confirm + password reset.
  The allowlist must contain exactly `https://greenshelf.online` (and nothing wildcard).
- Enable leaked password protection and set a minimum password length (12+ recommended).
- Turn on rate limiting / captcha for signups if spam appears.
- Email confirmations: ON (otherwise anyone can register with someone else's email).

## P1-8. Host-level headers (cannot be done in the HTML)

Meta CSP cannot carry `frame-ancestors`, so clickjacking protection needs real HTTP headers.
GitHub Pages cannot set custom headers. Options:
- Put Cloudflare (free) in front of greenshelf.online and add:
  `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=31536000`.
- Or accept the risk for now: the meta CSP already blocks script injection, and there is no
  click-to-pay style action on the site worth clickjacking. Low urgency, worth doing eventually.

## P2-9. Housekeeping

- Backups: Database > Backups, confirm daily backups are on.
- The anon key in config.js is public by design; if you ever rotate it, config.js is the only
  file to change.
- Photos of deleted listings stay in storage forever (see P1-6). Occasional manual sweep.

---

*Generated by the overnight security session. Client-side fixes that pair with this list are in
OVERNIGHT-REPORT.md.*
