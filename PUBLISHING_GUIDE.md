# Crew Compass — App Publishing Guide

This guide walks you through publishing Crew Compass on the **Google Play Store**, **Apple App Store**, and as a **Progressive Web App (PWA)** for desktop/web users.

---

## Prerequisites

Before you begin, you will need:

| Requirement | Cost | Link |
|:---|:---|:---|
| Apple Developer Account | $99/year | [developer.apple.com](https://developer.apple.com/programs/) |
| Google Play Developer Account | $25 one-time | [play.google.com/console](https://play.google.com/console/signup) |
| A Mac computer (for iOS builds) | — | Required by Apple |
| Node.js 18+ installed | Free | [nodejs.org](https://nodejs.org) |
| Xcode (for iOS) | Free | Mac App Store |
| Android Studio (for Android) | Free | [developer.android.com/studio](https://developer.android.com/studio) |

---

## Step 1 — Set Up Developer Accounts

### Apple Developer Account
1. Go to [developer.apple.com/programs](https://developer.apple.com/programs/)
2. Click **Enroll** and sign in with your Apple ID (or create one)
3. Select **Individual** or **Organization** enrollment
4. Pay the $99/year fee
5. Wait for approval (usually 24–48 hours)

### Google Play Console
1. Go to [play.google.com/console/signup](https://play.google.com/console/signup)
2. Sign in with a Google account
3. Accept the Developer Distribution Agreement
4. Pay the $25 one-time registration fee
5. Complete your developer profile

---

## Step 2 — Build the Web App

Before generating native apps, build the web app:

```bash
cd clean-crew-command
npm install
npm run build
```

This creates the `dist/` folder that Capacitor will bundle into the native apps.

---

## Step 3 — Generate Native App Projects

```bash
# Install Capacitor CLI if not already installed
npm install -g @capacitor/cli

# Add iOS platform (requires Mac)
npx cap add ios

# Add Android platform
npx cap add android

# Copy the web build into native projects
npx cap sync
```

---

## Step 4 — Add App Icons

The app icons are already generated in `public/icons/`. After running `npx cap add ios` and `npx cap add android`:

### iOS Icons
Copy `public/icons/app-icon-1024.png` into Xcode:
1. Open `ios/App/App.xcworkspace` in Xcode
2. In the Project Navigator, click **App → Assets.xcassets → AppIcon**
3. Drag `app-icon-1024.png` into the 1024×1024 slot
4. Xcode will auto-generate all required sizes

### Android Icons
1. Open Android Studio with the `android/` folder
2. Right-click `app/src/main/res` → **New → Image Asset**
3. Select `public/icons/app-icon-1024.png` as the source
4. Click **Next → Finish** to generate all sizes

---

## Step 5 — Configure App Details

### iOS (Xcode)
1. Open `ios/App/App.xcworkspace` in Xcode
2. Click the **App** target → **General** tab
3. Set:
   - **Display Name:** `Crew Compass`
   - **Bundle Identifier:** `com.summitfacilitiesgroup.crewcompass`
   - **Version:** `1.0.0`
   - **Build:** `1`
4. Under **Signing & Capabilities**, select your Apple Developer Team

### Android (Android Studio)
1. Open `android/app/build.gradle`
2. Confirm:
   ```gradle
   applicationId "com.summitfacilitiesgroup.crewcompass"
   versionCode 1
   versionName "1.0.0"
   ```

---

## Step 6 — Build Release Versions

### Android APK/AAB (for Google Play)
```bash
cd android
./gradlew bundleRelease
```
The `.aab` file will be at `android/app/build/outputs/bundle/release/app-release.aab`

You will need to **sign** the AAB with a keystore:
```bash
keytool -genkey -v -keystore crew-compass-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias crew-compass
```
Keep this keystore file safe — you need it for every future update.

### iOS IPA (for App Store)
1. In Xcode, select **Product → Archive**
2. In the Organizer, click **Distribute App → App Store Connect**
3. Follow the prompts to upload to App Store Connect

---

## Step 7 — Submit to Google Play

1. Go to [play.google.com/console](https://play.google.com/console)
2. Click **Create app**
3. Fill in:
   - **App name:** Crew Compass
   - **Default language:** English
   - **App or game:** App
   - **Free or paid:** Free (or Paid if you choose)
4. Complete the **Store listing**:
   - Short description (80 chars): "Workforce management for janitorial teams"
   - Full description: See below
   - Screenshots (at least 2 phone screenshots required)
   - Feature graphic: 1024×500px banner
   - App icon: 512×512px (use `public/icons/icon-512x512.png`)
5. Upload the `.aab` file under **Production → Create new release**
6. Complete the **Content rating** questionnaire
7. Set up **Privacy Policy URL:** `https://clean-crew-command.lovable.app/privacy-policy`
8. Submit for review (usually 1–3 days)

### App Description (copy-paste ready)
```
Crew Compass is the all-in-one workforce management platform built for janitorial and facilities teams.

FEATURES:
• Time Clock — GPS-verified clock in/out with geofencing
• Scheduling — Create and manage employee shifts
• Time Off Requests — Submit and approve requests in real time
• Quality Control — Red/Yellow/Green inspection scoring with photo evidence and PDF reports
• CRM — Manage customer accounts, contacts, and work orders
• Employee Onboarding — Digital W-4, I-9, Direct Deposit, and policy acknowledgments
• Messaging — 1-on-1, group chats, and company announcements
• Departments — Assign managers and employees to departments

Crew Compass keeps your team organized, accountable, and connected — every shift, every day.

Every great team needs a compass.
```

---

## Step 8 — Submit to Apple App Store

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **+** → **New App**
3. Fill in:
   - **Platform:** iOS
   - **Name:** Crew Compass
   - **Bundle ID:** com.summitfacilitiesgroup.crewcompass
   - **SKU:** crewcompass-001
4. Complete the **App Information**:
   - Category: Business
   - Privacy Policy URL: `https://clean-crew-command.lovable.app/privacy-policy`
5. Add **Screenshots** (required sizes: 6.7" iPhone, 6.5" iPhone, 12.9" iPad)
6. Upload the build from Xcode (it will appear in TestFlight first)
7. Complete the **App Review Information**:
   - Demo account credentials for the reviewer
   - Notes: "This is an invite-only workforce management app. Use the provided demo credentials to log in."
8. Submit for review (usually 1–3 days)

### Required for Apple Review
- ✅ Privacy Policy URL (done — `/privacy-policy`)
- ✅ Account deletion capability (done — in user menu)
- ✅ No public sign-up (done — invite-only)
- Demo login credentials (create a test account before submitting)

---

## Step 9 — Progressive Web App (PWA) for Desktop/Web

The app is already configured as a PWA with a web manifest. Users on desktop or mobile browsers can:
1. Visit `https://clean-crew-command.lovable.app`
2. Click **"Add to Home Screen"** (mobile) or **"Install"** (Chrome desktop)
3. The app will open like a native app without needing the app stores

No additional steps needed — this works automatically from your Lovable deployment.

---

## App Store Assets Checklist

| Asset | Size | Status |
|:---|:---|:---|
| App Icon (iOS) | 1024×1024px | ✅ `public/icons/app-icon-1024.png` |
| App Icon (Android) | 512×512px | ✅ `public/icons/icon-512x512.png` |
| Splash Screen | 1242×2688px | ✅ `public/icons/splash-screen.png` |
| Privacy Policy | URL | ✅ `/privacy-policy` |
| Screenshots | Various | ⏳ Take from the live app |
| Feature Graphic (Google) | 1024×500px | ⏳ Create a banner image |

---

## Taking Screenshots

Use the live app at `https://clean-crew-command.lovable.app` to take screenshots. Required screens to capture:
1. Login screen
2. Manager Dashboard
3. Schedule view
4. Time Clock
5. QA Inspection
6. Messaging

For iOS, use an iPhone simulator in Xcode at the required sizes. For Android, use the Android Emulator in Android Studio.

---

## Support

For questions about the publishing process, contact your developer or refer to:
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policy Center](https://play.google.com/about/developer-content-policy/)
- [Capacitor Documentation](https://capacitorjs.com/docs)
