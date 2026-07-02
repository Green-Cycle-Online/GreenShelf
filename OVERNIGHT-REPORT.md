# Overnight security + hardening report

Session date: 2026-07-02 (overnight). All changes are LOCAL ONLY, nothing committed or pushed.
Service worker cache bumped to `greenshelf-v32` (one bump covers this whole wave).

## The short version

- Wave 1 ran a 7-dimension multi-agent security audit plus a full map of every Supabase call.
- The subagent token budget hit the session limit partway through (resets 11:20am Muscat), so I
  verified every finding myself against the source instead of with agent panels, then fixed and
  live-verified everything in the preview browser. Nothing was left broken.
- 14 code fixes shipped across app.js, landing-new.html (+ new landing.js), sw.js, 404.html,
  privacy.html, terms.html.
- The things only you can do (RLS policies, auth settings, bucket rules, host headers) are in
  SECURITY-CHECKLIST.md, ordered by risk, with copy-paste console probes and SQL.

## What I fixed (Wave 1)

### app.js
1. Founder photo fallback was dead: the About section used inline `onerror` attributes, which our
   own CSP silently blocks. Replaced with JS error listeners. Verified live: broken image now
   hides and shows the initial-letter fallback.
2. Photo uploads: previously accepted any `image/*` type (including SVG, which can carry scripts)
   and took the storage file extension from the client filename. Now a strict whitelist
   (JPG/PNG/WebP/GIF), extension derived from the MIME type, and the file picker's accept list
   matches.
3. Listing form: whitespace-only title/name/contact passed HTML `required`. Now rejected with a
   friendly error. Contact details are validated per method (email shape for email, digits with
   country code for phone/WhatsApp). Verified live, both error paths.
4. Guest listing draft (`gs_pending_listing`): was restored from localStorage without checks.
   Now: expires after 24h (abandoned PII no longer lingers), only whitelisted fields restored,
   every field length-clamped, photo URLs must be https. Draft saves now carry a timestamp.
5. Missing maxlength added: signup name (60), profile name (60), profile school (120), report
   notes (500). Server-bound values also clamped in JS (saveProfile, report submit).

### landing-new.html (+ new file landing.js)
6. Removed the Google Fonts CDN (last third-party dependency on the page); fonts now self-hosted
   with the same woff2 files and preloads the main site uses.
7. Added a full CSP meta (script-src 'self' plus the hash of the small theme script) and a
   referrer policy. To make that possible, the big inline module moved to a new file: landing.js.
8. Removed the two inline `onerror` handlers (CSP-incompatible); image fallback is now one
   delegated capture-phase listener.
9. Photo URLs from the DB are now scheme-guarded (https only) in cards and the cover ribbon.
10. The landing query no longer uses `select('*')`: it fetches only the 9 columns the page
    renders, so lister contact info is not shipped to this page at all.

### sw.js
11. Fetch handler now ignores non-GET requests entirely.
12. Supabase network bypass uses an exact host match (endsWith '.supabase.co') instead of a
    substring match.
13. Static assets now use cache-first WITH background revalidation: pages still load instantly
    offline-safe, but security fixes reach returning visitors even between CACHE_NAME bumps.

### Secondary pages
14. 404.html: added CSP (with the correct hash for its theme script) + referrer meta.
    privacy.html + terms.html: fixed the favicon link (pointed at /favicon.ico, which does not
    exist; now /favicon.png). Their CSPs were already fine; they contain no scripts.

## Verified live (preview server, port 4173)

- Main app on SW v32: 9 cards, saved-hearts feature intact, dark theme, zero console warnings.
- About view: photo fallback fires correctly on a broken image; partners band still hides.
- Create-listing modal: renders, both new validation errors fire, accept list correct.
- landing-new.html: theme script runs under the new CSP (hash correct), landing.js loads,
  9 cards render, Fraunces loads from self-hosted files, zero console errors.
- 404.html: theme script runs under its new CSP.
- `node --check` passes on app.js, sw.js, landing.js. No em/en dashes in any authored file.

## SAFE TO PUSH

Everything above. All of it is live-verified and none of it changes visual design. Files touched:
app.js, sw.js, landing-new.html, landing.js (new), 404.html, privacy.html, terms.html,
plus this report and SECURITY-CHECKLIST.md.

## NEEDS MY REVIEW (decisions I did not make for you)

1. **No moderation queue exists.** Listings are public the instant anyone posts. Fine for launch
   week, risky at scale. See SECURITY-CHECKLIST P0-3 for options; I can build the client side of
   an approval flow whenever you want.
2. **Stray dev pages at the web root:** book-preview.html, hero-preview.html, intro-preview.html.
   They load Google Fonts from CDN and ship with every deploy. I did not delete anything.
   Recommend deleting them (or moving to a /dev folder) before sharing the site.
3. **landing-new.html is orphaned:** no page links to it. Decide whether it becomes the real
   landing page or gets removed; it is now hardened either way.
4. **Storage orphans:** deleting a listing or account never deletes its photos from the bucket.
   Low risk, costs storage. Fix belongs server-side or in a later client change.
5. **SW behavior change to review:** background revalidation means slightly more network traffic
   (one conditional refetch per cached asset per visit). I judged this a good trade for security
   patch delivery; revert sw.js if you disagree.
6. **The whole SECURITY-CHECKLIST.md** is yours: RLS is the only real security boundary this
   architecture has, and only you can see the dashboard.

## Waves 2 and 3: re-audit over the fixed code (both DRY)

Agent panels were unavailable (token limit), so these were careful single-auditor passes by me
over every surface Wave 1 did not close out. Checked and found CLEAN:

- Deep links: the #listing/<id> hash value only ever flows into an array comparison and a
  parameterized PostgREST .eq() filter, never into the DOM.
- Error logger: capped at 50 entries, message/source length-clamped, JSON.parse guarded, and the
  admin render escapes every field.
- All JSON.parse of localStorage: wrapped, with safe fallbacks (and the draft path now whitelists).
- Toasts and confirm dialogs: textContent / escaped. All error messages land in textContent or
  escaped interpolations.
- Tabnabbing: every target=_blank carries rel="noopener noreferrer". No window.open anywhere.
- ReDoS: every regex that touches user input is linear (no nested quantifiers).
- Filter chips, admin health check, relative-time formatter: all escaped or synthesized.
- vendor/supabase.js: no eval/Function, no unexpected hosts (only MDN/GitHub doc links). Official
  build shape. styles.css: no external url() or @import.

Two consecutive dry waves = the security stopping condition. Caveat recorded honestly: waves 2-3
were one careful reviewer, not adversarial agent panels, because the subagent budget was gone.

## Secondary mission (conservative pass, cache now v33)

- Accessibility audit on the live DOM: exactly one h1, zero heading-level skips, zero images
  missing alt, zero unnamed buttons. One fix applied: the JS-created area filter select had no
  accessible name; it now has aria-label "Filter by area" (matching its three siblings).
- Responsive: 375px checked on the main app (both themes) and the landing page: no horizontal
  scroll anywhere, 9 cards render.
- Share-readiness: og:image, twitter card, manifest icons AND both manifest screenshots verified
  present on disk with correct references. WhatsApp previews should work once deployed.
- Robustness: skeleton loaders, empty states, offline navigation fallback, and submit feedback
  all already existed and survived tonight's changes (spot-verified live).
- Cache bumped to greenshelf-v33 for the a11y fix; verified live (v33 active, cards render,
  aria-label present, console clean).

## NEEDS MY REVIEW, addition

7. **Sample data is still live:** all 9 current listings are "(Sample)" entries. Clear them
   (admin delete) before sharing the site publicly; I cannot and did not touch the database.
