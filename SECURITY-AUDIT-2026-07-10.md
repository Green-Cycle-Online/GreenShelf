# GreenShelf security audit, 2026-07-10

Full-surface pass over web PWA, native app, and the Supabase backend, assuming an
attacker who holds the public anon key (everyone does) and calls the Supabase REST /
Realtime endpoints directly, not just through the UI. This builds on the overnight
hardening waves (see OVERNIGHT-REPORT.md); it does not repeat what those already fixed.

Bottom line: the client code, web and native, is in good shape. Every finding that can
actually hurt you lives in the Supabase backend (RLS, storage, auth settings), which I
cannot see or change from here. The fix for all of it is one SQL file plus a short list
of dashboard toggles.

Deliverables in this pass:
- `supabase-security-policies.sql` - idempotent, paste-and-run RLS + storage policies.
- This report.
- Apply checklist below.
- Vault updates to "Security and Privacy.md" and the "Security Checklist" reference.

No client code needed changing: the sinks I re-reviewed are already escaped and guarded.

---

## Findings by severity

### CRITICAL (verify now, all backend, all covered by the SQL file)

**C1. RLS is the only real boundary, and I cannot confirm it is on.**
The whole architecture rests on Row Level Security. The anon key is public by design
(confirmed: the JWT in `config.js` and `mobile/lib/supabase.ts` decodes to `role: anon`,
expires 2036, no service_role anywhere). If any table has RLS disabled or a `USING (true)`
write policy, the anon key can read or write it directly. I can reason about what the
policies *should* be but cannot read the live ones. `supabase-security-policies.sql`
sets every policy correctly and idempotently. Run it, then run the console probes in the
apply checklist to prove the boundary holds.

**C2. `profiles.is_admin` self-escalation.**
Admin is decided entirely by the `is_admin` boolean on a user's own profile row. Both
clients gate the admin UI on a client-side `isAdmin` flag (`app.js:403`,
`mobile/app/admin.tsx:28`), which is only cosmetic. If the `profiles` UPDATE policy lets a
user write their own row (it must, so they can edit their name), a crafted request can ride
that same policy and flip `is_admin` to true, making the attacker an admin. RLS cannot stop
this because `id = auth.uid()` is still true. The fix is column-level privilege, in the SQL
file: revoke table-wide UPDATE from `authenticated`, grant back only
`(full_name, school, grade_level)`. Until applied, treat admin as unprotected.

### HIGH

**H1. Contact-info scraping (PII).**
Listings carry `contact_method` + `contact_value` (phone / WhatsApp / email) on a publicly
readable row. Anyone with the anon key can run
`select contact_method, contact_value from listings` and harvest every lister's contact in
one request. This is inherent to "no account to browse" plus contact-on-listing; RLS cannot
hide one column from anonymous readers while still letting them browse. The SQL file tightens
everything else but deliberately leaves this as a product decision. The minimum-viable fix
that keeps anonymous browsing is documented at the bottom of the SQL file: serve a
contact-free view to anon, and reveal contact only through a security-definer RPC that
requires any signed-in (still free) account. Recommendation: acceptable to launch as-is given
the small Oman audience and the report button, but plan the RPC before the site is promoted
widely.

**H2. Admin write paths depend on RLS you cannot see.**
The admin dashboard deletes any listing (`app.js:1992`), dismisses reports
(`app.js:896`), and toggles `site_settings` (`app.js:2181`). With only client-side gating,
a non-admin anon-key user could call the same endpoints. The SQL file makes DELETE,
reports UPDATE/SELECT, and site_settings writes admin-only via a `public.is_admin()`
security-definer helper. Verify with the non-admin probes in the checklist.

### MEDIUM

**M1. Storage bucket rules must match the client.**
The client uploads to `book-photos` under a `<uid>/` path prefix with a MIME-derived
extension and an image-only whitelist (`app.js:26` `safePhotoExt`, `mobile/lib/api.ts:69`).
None of that binds a raw anon-key call. Without bucket policies, an anon-key holder could
upload arbitrary files, and user A could overwrite user B's photo. The SQL file sets:
public read; INSERT/UPDATE/DELETE for authenticated only and only within the caller's own
`<uid>/` folder; a 5 MB cap; and a MIME whitelist (jpeg/png/webp/gif plus heic/heif for the
iOS app, SVG intentionally excluded).

**M2. Auth settings (dashboard only).**
Confirm in Authentication > Settings: email confirmations ON (or anyone can register with
someone else's address), leaked-password protection ON, minimum password length 12+, and
the redirect allowlist set to exactly `https://greenshelf.online` with no wildcard (both
clients build reset/confirm links from the origin). Turn on signup rate-limiting/captcha if
spam appears.

### LOW

**L1. Dependency vulnerabilities are all dev/build tooling, none shipped.**
Root `npm audit`: 8 findings (6 high, 2 moderate), every one inside `@capacitor/assets`
(a devDependency used only to generate icons): `tar`, `uuid`, `xcode`. Mobile `npm audit`:
11 moderate, all one root cause, `uuid <11.1.1` (GHSA-w5hq-g745-h8pq) pulled through
`xcode` into the Expo CLI / prebuild / metro build chain. None of this is in the code that
runs on a user's device, and none is reachable by an anon-key attacker. `npm audit fix
--force` would bump Expo/Capacitor majors and break the build, so do NOT blind-bump; let the
patched versions arrive with the next Expo/Capacitor upgrade.

**L2. No moderation queue.**
Listings go live instantly (statuses `available` / `claimed` only, no `pending`). Spam
appears to everyone immediately. The SELECT policy in the SQL file is written so that if you
later add a `pending` or `hidden` status it will NOT leak to anonymous visitors, leaving the
approval flow easy to add later. Current mitigation is the report button.

**L3. Storage orphans.**
Deleting a listing or account never deletes its photos from the bucket. Low risk (public
images), costs storage. A periodic manual sweep, or a future server-side cleanup, is enough.

**L4. Host-level headers.**
The meta CSP is strong (`script-src 'self'` + hash, `object-src 'none'`, `base-uri 'self'`,
`form-action 'self'`; `index.html:6`). Meta cannot carry `frame-ancestors`, so clickjacking
protection needs real HTTP headers, which GitHub Pages cannot set. If you front the site with
Cloudflare, add `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=31536000`. Low urgency:
there is no click-to-pay action worth clickjacking. Minor: `style-src 'unsafe-inline'` remains
(inline styles); acceptable, tightening it would need a CSS refactor.

---

## What I checked and found clean

- **Stored XSS (web):** every user-content sink in `app.js` routes through `escapeHtml`
  (`app.js:2034`, covers `& < > " '`), including titles, descriptions, owner names, contact
  values, subjects, areas, statuses, report reasons, and interpolated ids. Photo URLs are
  https-filtered before rendering (`app.js:1850`). Contact links are `encodeURIComponent` /
  digit-normalised then escaped in the href (`app.js:2021`, `1915`).
- **XSS (native):** React Native renders text nodes, not HTML; no `dangerouslySetInnerHTML`
  or HTML injection path exists.
- **Secret hygiene:** only the anon JWT ships. No service_role key, `.env`, keystore, or
  signing password in the working tree or in git history. `android-signing/` (which does hold
  the real `.jks` + `keystore.properties` on disk) is gitignored and was never committed.
  `.gitignore` correctly excludes `android-signing/`, `*.jks`, `*.keystore`,
  `keystore.properties`, and build cruft.
- **Auth flows:** email+password; session persists in localStorage (web) / AsyncStorage
  (native) / native Preferences in the iOS wrapper; reset uses origin-based redirect. No
  weaknesses in client handling; the enforcement gaps (email confirmation, leaked-password,
  redirect allowlist) are dashboard settings, see M2.
- **Upload path:** storage key is `<uid>/<timestamp>-<rand>.<ext>` with the extension from a
  MIME whitelist, never the raw client filename; SVG blocked.

---

## Apply checklist (Supabase dashboard, in order)

1. **APPLY IN SUPABASE DASHBOARD** - SQL Editor: paste all of
   `supabase-security-policies.sql` and run it. Safe to re-run. This closes C1, C2, H2, M1,
   and L2's future-proofing.

2. **APPLY IN SUPABASE DASHBOARD** - Storage > book-photos: confirm the run set the bucket to
   public with a 5 MB limit and the image MIME whitelist (the SQL does this; verify in the UI).

3. **APPLY IN SUPABASE DASHBOARD** - Authentication > Settings (M2): email confirmations ON;
   leaked-password protection ON; min password length 12+; redirect allowlist =
   `https://greenshelf.online` only, no wildcard.

4. **Verify the boundary holds.** On the live site, signed OUT, in the browser console:
   ```js
   // Should return ONLY available/claimed listings, and NO other users' profiles.
   console.log(await window.supabase.from('listings').select('*').limit(100))
   console.log(await window.supabase.from('profiles').select('*').limit(5)) // expect 0 rows
   console.log(await window.supabase.from('reports').select('*').limit(1))  // expect 0 rows/error
   ```
   Then signed in as a NORMAL (non-admin) user:
   ```js
   const uid = (await window.supabase.auth.getUser()).data.user.id
   // MUST fail or leave is_admin unchanged:
   console.log(await window.supabase.from('profiles').update({ is_admin: true }).eq('id', uid).select())
   // MUST fail:
   console.log(await window.supabase.from('reports').select('*').limit(1))
   console.log(await window.supabase.from('site_settings').upsert({ key: 'show_live_counter', value: false }, { onConflict: 'key' }))
   ```

5. **Optional / later:** decide on H1 (contact RPC), L4 (Cloudflare headers), L3 (orphan
   sweep), L2 (moderation queue). None blocks launch.

Nothing in this pass was pushed or deployed. All backend changes are yours to apply.
