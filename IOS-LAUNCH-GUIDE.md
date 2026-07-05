# GreenShelf iOS: launch guide

Everything to get GreenShelf onto the App Store. The code side is done; this is the
part that only you can do (Xcode + Apple's websites, on your Mac). Follow it top to
bottom. Budget one focused evening for the first submission, then 1 to 3 days for
Apple's review.

App identity (already set, do not change):
- Bundle ID: `com.greenshelf.app`
- App name: GreenShelf
- The app loads a bundled copy of your website (offline-capable) and talks to Supabase
  over the network, exactly like the site.

---

## What I already did (no action needed)

- Wrapped the site with Capacitor 8 and generated the `ios/` Xcode project.
- Bundled the web app into `www/` (so it launches instantly, even offline).
- Guarded the code for native: service worker is skipped in the app, auth email links
  point at https://greenshelf.online, the session is stored in native Preferences so
  iOS cannot silently log users out, and the CSP allows the Capacitor origin.
- Wired push notifications (permission + registration) and status-bar theming.
- Generated all app icons and the splash screen from your logo.

---

## STEP 0: Install the tools (do this first, some are slow)

1. **Full Xcode** from the Mac App Store (free, ~7 GB, slow). You currently only have
   the Command Line Tools, which cannot build apps. Open Xcode once after installing so
   it finishes setup, and accept the license.
2. **CocoaPods.** Your Mac's built-in Ruby (2.6) is too old for modern CocoaPods, so use
   Homebrew, which brings its own Ruby. In Terminal:
   ```
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   Follow its final "Next steps" to add brew to your PATH, then:
   ```
   brew install cocoapods
   ```
   Verify: `pod --version` prints a number (1.14 or higher).
3. **Finish the iOS project** (installs the native dependencies). In the project folder:
   ```
   cd /Users/hitesh/Documents/GreenShelf
   npx cap sync ios
   ```
   This runs `pod install` and produces `ios/App/App.xcworkspace`.

> If you change any website file later, re-run `npm run sync` to copy it into the app,
> then rebuild in Xcode. The website and the app share the same source.

---

## STEP 1: Open the project and set signing

1. Open the workspace (the `.xcworkspace`, NOT the `.xcodeproj`):
   ```
   open ios/App/App.xcworkspace
   ```
2. Xcode menu > Settings > Accounts > + > Apple ID. Sign in with your Apple Developer
   account. Your paid membership shows as a Team. Use that team, not "(Personal Team)".
3. Left sidebar: click the blue "App" project > TARGETS "App" > "Signing & Capabilities".
   - Tick "Automatically manage signing".
   - Team: pick your paid team.
   - Bundle Identifier: confirm it reads `com.greenshelf.app`.
   - A green line showing a signing certificate and provisioning profile means success.

---

## STEP 2: Add the native settings that Apple requires

These are one-time edits inside Xcode.

### 2a. Camera and photo permission text
Sidebar > "App" target > "Info" tab (or open `ios/App/App/Info.plist`). Add two rows
(right-click > Add Row), keys and values exactly:

- `Privacy - Camera Usage Description`
  `GreenShelf uses your camera to take photos of the books you want to share.`
- `Privacy - Photo Library Usage Description`
  `GreenShelf accesses your photo library so you can pick existing pictures of your books to add to your shelf.`

Without these, the app crashes the moment someone taps to add a photo, and Apple
rejects it.

### 2b. Encryption declaration (stops a question on every upload)
In the same Info list add:
- `App Uses Non-Exempt Encryption` = `NO`
(raw key name: `ITSAppUsesNonExemptEncryption`, Boolean, NO). GreenShelf only uses
standard HTTPS, which is exempt.

### 2c. Privacy manifest (hard requirement, or Apple emails you ITMS-91053)
I have placed a ready file at `ios/App/App/PrivacyInfo.xcprivacy`. Confirm Xcode is
copying it:
- Select the "App" target > "Build Phases" > "Copy Bundle Resources".
- If `PrivacyInfo.xcprivacy` is not listed, click + and add it.
If for any reason the file is missing, create it: File > New > File > "App Privacy File",
name it `PrivacyInfo.xcprivacy`, target "App", then paste the contents from the
"Privacy manifest contents" section at the bottom of this guide.

### 2d. Push notifications capability
- "Signing & Capabilities" tab > "+ Capability" (top left) > double-click
  "Push Notifications". This adds the entitlement.
- Optional: add "Background Modes" and tick "Remote notifications".

### 2e. Do NOT add App Transport Security
Do not add any `NSAppTransportSecurity` keys. Supabase uses valid HTTPS, so the default
(no keys) is correct. Adding an "allow arbitrary loads" exception can get you rejected.

---

## STEP 3: Test on your iPhone

1. Plug in your iPhone. Top bar of Xcode: pick your device (not a Simulator, because push
   and the camera need a real device).
2. Press the Run button (triangle). First time, your phone asks you to trust the developer:
   Settings > General > VPN & Device Management > trust your developer certificate.
3. Test the real flow: browse books, open one, add a listing with a photo, sign in, sign
   out. It should feel like a normal app with no browser bar.

If the screen is blank: check Xcode's console for a CSP or a "failed to load" error, and
tell me what it says. The most common cause is a web file that did not get copied; running
`npm run sync` again fixes it.

---

## STEP 4: App Store Connect (the listing)

Do these on https://appstoreconnect.apple.com and https://developer.apple.com.

### 4a. One-time account setup (or buttons stay greyed out)
- App Store Connect > Business > Agreements: sign the latest Apple Developer Program
  License Agreement. New apps cannot be created until this is signed.
- developer.apple.com > Certificates, Identifiers & Profiles > Identifiers: confirm
  `com.greenshelf.app` exists (Xcode may have created it). Click it and tick "Push
  Notifications" if not already on.

### 4b. Create the app record
App Store Connect > Apps > + > New App:
- Platform: iOS
- Name: GreenShelf (max 30 characters, must be unique across the store; if taken, try
  "GreenShelf Oman" or "GreenShelf Books")
- Primary language: English
- Bundle ID: select `com.greenshelf.app`
- SKU: `GREENSHELF-IOS-001` (private, permanent, any text)
- Full access. Create.

### 4c. Screenshots (required)
You need at least one screenshot for the 6.9 inch iPhone size. Accepted portrait sizes:
1320 x 2868, or 1290 x 2796, or 1260 x 2736 pixels. One set covers all iPhones.
Easiest way: run the app in the iPhone 16/17 Pro Max Simulator (Xcode > pick that
simulator > Run), then Device > Screenshot (or Cmd-S) on 3 to 5 good screens (browse,
a listing, add-a-book, saved). If you support iPad too, add 13 inch shots at 2064 x 2752,
otherwise leave iPad out.

### 4d. App icon
The 1024 x 1024 store icon comes from the app build automatically (I generated it). If
App Store Connect asks separately, upload `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
the 1024 file, PNG, no transparency, no rounded corners.

### 4e. App Privacy (the nutrition label)
App Store Connect > your app > App Privacy. Add a Privacy Policy URL:
`https://greenshelf.online/privacy.html`. Then declare exactly this (everything is
"linked to the user's identity", and NOTHING is used for tracking):

| Data type | Collected | Linked to identity | Tracking | Purpose |
|---|---|---|---|---|
| Email address | Yes | Yes | No | App Functionality |
| Name | Yes | Yes | No | App Functionality |
| Phone number (WhatsApp) | Yes | Yes | No | App Functionality |
| Photos | Yes | Yes | No | App Functionality |
| Other user content (the area you type) | Yes | Yes | No | App Functionality |

Do NOT declare "Location" (the area is free text you type, not GPS). Do NOT enable any
tracking. Because nothing is tracking, you will not need an app-tracking permission popup.

### 4f. Age rating
Answer the questionnaire. The key answer: "User-generated content" = Yes (people post
listings). That, with your report feature, usually lands the app at 13+. Everything else
(violence, gambling, etc.) = None.

### 4g. Pricing and the rest
- Pricing: Free.
- Availability: include Oman (and anywhere else you want).
- Support URL (required): `https://greenshelf.online` (or a contact page).
- Description and keywords: write a short, honest description of the book exchange.

---

## STEP 5: Upload the build and submit

1. In Xcode, top bar: change the device target to "Any iOS Device (arm64)". You cannot
   archive with a Simulator selected.
2. Menu: Product > Archive. Wait for it to build.
3. The Organizer window opens. Click "Distribute App" > "App Store Connect" > "Upload".
   Keep automatic signing. Upload.
4. Wait 5 to 60 minutes for Apple to process the build.
5. Back in App Store Connect > your app version > "Build" section: select the build that
   just appeared.
6. Answer the export-compliance question (No, because of the Info.plist key in 2b).
7. Click "Add for Review" > "Submit for Review".

Then wait. Apple usually reviews a first app within 1 to 3 days. If rejected, they tell
you exactly why in Resolution Center; send me the message and I will fix it.

### App Review notes (paste this in the "Notes" box, it helps avoid a 4.2 rejection)
> GreenShelf is a free peer-to-peer school textbook exchange for families in Oman. Users
> create an account, list books with photos taken in-app, browse and filter listings, save
> favourites, and contact each other to arrange a free handover. The app works offline for
> browsing its shell, uses the device camera for listing photos, and supports push
> notifications. It is a functional community service, not a marketing site.

---

## Known limitations (fine for launch, note for later)

1. Email confirmation and password reset links open in the browser (Safari), not back
   inside the app. The account still gets verified; the user then returns to the app and
   signs in. A future update can deep-link these straight into the app.
2. Push notifications: the app asks permission and registers a device token, but actually
   SENDING a notification needs a small backend piece (an APNs key plus a Supabase edge
   function). That is phase 2; the capability is in place so a later update can light it up
   without another big review.
3. If you would rather skip email confirmation entirely for launch, turn off "Confirm
   email" in Supabase > Authentication > Providers > Email, and sign-up gives an instant
   session. Trade-off: no email verification.

---

## Supabase settings to check for the app

- Authentication > URL Configuration > Redirect URLs: make sure
  `https://greenshelf.online` is on the allow-list (needed for the in-app auth links).
- Everything in SECURITY-CHECKLIST.md still applies; the app uses the same anon key and
  the same RLS policies as the website.

---

## Privacy manifest contents (only if you need to recreate the file in 2c)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key><false/>
  <key>NSPrivacyTrackingDomains</key><array/>
  <key>NSPrivacyCollectedDataTypes</key><array/>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array><string>CA92.1</string></array>
    </dict>
  </array>
</dict>
</plist>
```

---

*Generated by the overnight session. The web app, the security fixes, and the app wrapper
are all done and verified locally. Nothing here has been pushed or submitted; that is
yours to do.*
