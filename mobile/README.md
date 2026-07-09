# GreenShelf (native app)

A genuine native rebuild of GreenShelf in Expo (React Native + TypeScript, expo-router).
It reuses the exact same Supabase backend as the website (same URL, same public anon key)
and the same brand, colors, and type system.

This folder is fully self-contained. It does NOT touch the live website files in the parent
folder, and it does NOT touch the existing Capacitor `ios/` or `android/` projects at the repo
root. `expo prebuild` here generates `mobile/ios` and `mobile/android`, which are separate.

## Bundle identifiers (reused, do not change)

- iOS: `com.greenshelf.app`  (same as the current App Store app)
- Android: `com.greenshelf.oman`

## Requirements

- Node 20 or 22 LTS recommended. (Node 24 works for building but is newer than Expo's tested range.)
- Xcode 16+ with an iOS simulator, CocoaPods.

## Run it in the iOS Simulator (development)

```
cd mobile
npx expo start --ios
```

The first launch installs Expo Go on the simulator, then loads the app. Press `r` in the Expo
terminal to reload, `i` to reopen iOS. All the native modules used (image picker, haptics,
NetInfo, svg, reanimated, etc.) are included in Expo Go, so no custom dev build is needed to
preview.

## Build a native project and open in Xcode (for App Store archive)

```
cd mobile
npx expo prebuild --platform ios    # generates mobile/ios with bundle id com.greenshelf.app
npx pod-install                     # or: cd ios && pod install
open ios/GreenShelf.xcworkspace
```

Then in Xcode: pick your team/signing, choose "Any iOS Device", Product > Archive, and upload.

Android:

```
npx expo prebuild --platform android   # applicationId com.greenshelf.oman
```

Nothing here submits to any store. All shipping is done by you.

## Where things live

- `app/` - screens (expo-router). `(tabs)/` is the bottom-tab navigator.
  - `(tabs)/index.tsx` - Browse (search, filters, pull-to-refresh)
  - `(tabs)/saved.tsx` - Saved (on-device favourites, no account)
  - `(tabs)/create.tsx` - the List action (opens the create modal)
  - `(tabs)/profile.tsx` - Profile / auth / theme / info links
  - `listing/[id].tsx` - listing detail (carousel, contact, share, save, report)
  - `create.tsx` - create / edit listing (photo upload, auth-gated guest flow)
  - `auth.tsx` - sign in / create account / reset password
  - `admin.tsx` - admin dashboard (visible to admins only)
  - `info/*` - How it works, Our goals (SDG), About, FAQ, Privacy
- `lib/` - data layer: `supabase.ts`, `api.ts` (all queries), `types.ts`, `auth.tsx`,
  `saved.ts`, `constants.ts`, `format.ts`, `haptics.ts`, `useListings.ts`
- `theme/` - `tokens.ts` (colors/spacing/type from the website CSS) and `theme.tsx` (provider)
- `components/` - shared UI (ListingCard, Button, Tag, Select, FilterSheet, etc.)

## Notes on parity with the website

- Same Supabase tables: `listings`, `profiles`, `reports`, `site_settings`; same storage
  bucket `book-photos`.
- Browse query matches the site: `status = available`, last 6 months, newest first.
- Same option lists (subjects, Oman areas, grades, conditions, contact methods, report reasons).
- Same Oman phone normalization for WhatsApp / call links.
- Browsing needs no account. Listing, reporting, and profile require sign-in, exactly like the site.
