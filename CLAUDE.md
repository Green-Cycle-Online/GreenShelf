# GreenShelf

A free, no-account-to-browse school-book exchange for families in Oman. Web PWA + native app,
shared Supabase backend (Postgres + Auth + Storage, protected by Row Level Security).

## Ground truth (read before doing anything)

- **Ship vehicle = the Expo app in `mobile/`** (Expo SDK 57, React Native, expo-router, TypeScript).
  It runs via `cd mobile && npx expo start` (Expo Go), and ships via
  `npx expo prebuild --platform ios && npx pod-install && open ios/GreenShelf.xcworkspace` -> Archive.
  Bundle id `com.greenshelf.app` (iOS), `com.greenshelf.oman` (Android).
- **The root Capacitor app is LEGACY** - the old website-in-a-webview being replaced by `mobile/`.
  It reuses the same bundle id so the Expo build becomes the next version of the same store app.
  Do NOT develop on it. It is not the real app.
- **The Obsidian vault at `~/Documents/GreenShelf/GreenShelf/` is the planning brain.** Read it first
  (start at `GreenShelf.md`). It holds direction, decisions, architecture. Keep it updated as things change.
- The Supabase anon key in `config.js` / `mobile/lib/supabase.ts` is PUBLIC BY DESIGN. RLS is the only
  real protection. Backend policy changes live in `supabase-security-policies.sql` (apply in the dashboard).

## Operating rules (every turn)

1. Ground truth before claims. Read the actual files (grep/cat/git) before stating how anything works.
   If inferring, say "inferring" and verify.
2. Read the brain first (this file + the vault).
3. Verify by running, not asserting. Never say fixed/done/works until run and seen. State HOW it was
   confirmed, and separate VERIFIED from ASSUMED/untested.
4. One step at a time. Give one action, then STOP and wait for the user's screenshot/output.
5. Own mistakes, re-ground fast. If evidence contradicts, correct it. If stuck in a tooling rabbit hole
   (Homebrew/CocoaPods/Xcode-for-Expo), STOP and re-read the setup - the Expo app runs via `expo start`.
6. Be decisive, flag the tradeoff. Recommend, don't hand over a menu. Call out risks honestly.
7. Lead with the bottom line, then detail, in plain English.

## Do-not-break rules

- Do NOT touch the live website (root static files: `index.html`, `app.js`, `styles.css`, `sw.js`, etc.)
  or the root Capacitor `ios/` / `android/` projects.
- No em dashes or en dashes anywhere (code, copy, comments, docs). Plain hyphens only.
- Do NOT bump versionCode / versionName or submit to the stores as part of unrelated work.
- Confirm with the user before anything destructive or irreversible (delete, submit, version bump).
