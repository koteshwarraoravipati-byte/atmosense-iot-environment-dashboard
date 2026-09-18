# Atmosense website and mobile app guide

## Website

The redesigned application is a responsive website with a landing page, login, account creation, protected workspace, live environmental cards, trend chart, device area, history placeholder, and mobile bottom navigation.

Run it from the dashboard folder:

```bash
npm install
copy .env.example .env   # PowerShell; use `cp .env.example .env` in Linux
npm start
```

The included `.env.example` enables the prepared sample telemetry dataset. The server loads `.env` automatically.

Open `http://localhost:3000`.

## Install it on a phone as an app

The project is a Progressive Web App. Deploy it over HTTPS, open the website on Android Chrome, choose the browser menu, then choose **Install app** or **Add to Home screen**. On iPhone Safari choose **Share → Add to Home Screen**.

A secure HTTPS deployment is required for service-worker installation. Localhost is allowed for development.

## Build an Android APK later

The PWA can be wrapped with Capacitor after the web deployment is stable:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init Atmosense com.atmosense.monitor --web-dir public
npx cap add android
npx cap copy android
npx cap open android
```

Build the APK from Android Studio. The Android wrapper does not replace real authentication or AWS IoT provisioning; it packages the website for mobile.

## Authentication note

The current demo uses an Express server, a local JSON user store, salted `scrypt` password hashes, and HttpOnly session cookies. It is suitable for a classroom demo on a private server. Before public production, migrate users and sessions to Supabase Auth, Cognito, or another managed auth service; do not expose `dashboard/data/users.json` publicly.
