# GreenShelf iOS: the final steps (upload to App Store)

Good news to wake up to: **your app is fully built, signed, and archived.** I fixed six
separate build problems overnight and got a clean archive. It is already sitting in Xcode's
Organizer, waiting for you.

All that is left is the upload, which has to be done by you because it needs your Apple ID
login (I could not do that part while you were logged out). It is about 6 clicks and 5 minutes.

---

## Do this (Xcode is already open)

1. In Xcode, top menu bar: **Window -> Organizer**.
   (A window opens listing your archives. You should see **GreenShelf**, dated today.)

2. Select the **GreenShelf** archive on the left, then click the big blue
   **Distribute App** button on the right.

3. Choose **App Store Connect** -> **Next**.

4. Choose **Upload** -> **Next**.

5. Keep every default checkbox as-is, keep **Automatically manage signing** -> **Next**.
   (Xcode now creates the distribution certificate and profile for you. This is the step my
   command line could not do without your login. It takes a moment.)

6. Click **Upload**.

It uploads (1 to 3 minutes), then shows **"Upload Successful."**

---

## After the upload

1. Apple "processes" the build for 5 to 60 minutes. You do not have to wait at the screen.
2. Go to https://appstoreconnect.apple.com -> your app **GreenShelf Oman** -> the **1.0**
   version page.
3. Scroll to the **Build** section, click **Add Build** (or the + ), and select the build that
   just appeared.
4. The last things still needed on that page before you can submit:
   - **Screenshots** (at least one iPhone 6.9 or 6.5 inch). Fastest way: run the app in the
     iPhone 16 Pro Max Simulator (Xcode -> pick that simulator -> Run), press **Cmd+S** on 3 to
     5 screens, and drag those images into the screenshots box.
   - Everything else (description, privacy, age rating, pricing) you already filled in.
5. Click **Add for Review** -> **Submit for Review**.

Then Apple reviews it (usually 1 to 3 days). If they reject it, paste me the message and I will
fix it.

---

## If the Organizer is empty or the archive is missing

Just re-create it (everything is fixed now, so it will work in one go):
- Top bar device selector -> **Any iOS Device (arm64)**.
- Menu: **Product -> Archive**.
- Wait a few minutes, then the Organizer opens automatically. Continue from step 2 above.

---

## What I fixed to get here (for your reference)

The app itself was always fine, it compiled cleanly every time. These were all iOS project
setup gaps from me assembling the project by hand (the normal `cap add ios` tool could not run
on your network):

1. Missing `config.xml` (Capacitor Cordova file).
2. Pod frameworks had no signing team -> set to your team `M6X8998H58`.
3. Cordova headers use old-style quoted imports that Xcode 26 rejects -> turned that check off.
4. `ENABLE_USER_SCRIPT_SANDBOXING` was on and blocked the framework copy -> turned off.
5. Xcode 26's module verifier could not rebuild Capacitor's module -> disabled for pods.
6. The old CocoaPods (pinned to your Mac's Ruby 2.6) has a framework-copy bug during archive
   -> switched the pods to **static linking**, which removes that step entirely.

All of these are saved in your project, so future archives just work.

Files changed for the app (all committed via GitHub Desktop when you are ready):
`ios/App/Podfile`, `ios/App/App.xcodeproj/project.pbxproj`, `ios/App/App/config.xml`,
`ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme`, and the pod reinstall.

---

*Archive built and verified overnight. The upload is yours: Window -> Organizer -> Distribute.
That is the finish line.*
