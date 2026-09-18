# Atmosense website and mobile app guide

## Website

Atmosense is a responsive IoT environmental monitoring dashboard with a landing page, demo or Supabase-ready authentication, live environmental cards, historical charts, CSV export, device management, configurable alerts, dark mode, and a college presentation page.

Run it from the dashboard folder:

```bash
npm ci
copy .env.example .env   # use `cp .env.example .env` on Linux/macOS
npm start
```

The included `.env.example` enables sample telemetry. The server loads `.env` automatically. Open `http://localhost:3000`.

## Authentication modes

Demo mode uses an Express server, a local JSON user store, salted `scrypt` password hashes, and HttpOnly session cookies. It is suitable for a private classroom demo only.

Production mode uses Supabase Auth. The browser sends the Supabase access token as a bearer token on protected API calls. The server validates that token with Supabase Auth, and RLS limits devices, telemetry reads, and alert settings to the authenticated owner. Supabase ingestion uses `SUPABASE_SERVICE_ROLE_KEY` only on the private server and never sends it to the browser.

Run `supabase/schema.sql`, configure the Supabase site/redirect URLs, and test expired sessions and cross-user isolation in a staging project before using real users.

## Mobile PWA

The project is a Progressive Web App. Deploy it over HTTPS, open the website on Android Chrome, and choose **Install app** or **Add to Home screen**. On iPhone Safari choose **Share → Add to Home Screen**.

A secure HTTPS deployment is required for service-worker installation. Localhost is allowed for development. The mobile layout includes compact navigation, responsive cards, charts, device filters, alert settings, and presentation content.

## Build an Android APK

The repository includes `dashboard/capacitor.config.json` with app ID `com.atmosense.monitor` and pins Capacitor 7.6.9, the latest Node 20-compatible release used by this project.

Required on the build machine:

- Node.js 20 or newer
- JDK 17
- Android Studio with an Android SDK and emulator/device
- Android SDK platform/build tools installed through Android Studio

Create the native wrapper once, then sync web assets after every web change:

```bash
cd dashboard
npm ci
npm run cap:add:android   # first build only; creates the local android/ project
npm run cap:sync
npm run cap:android      # opens Android Studio
```

Build and sign the APK/AAB from Android Studio. The Android wrapper packages the website; it does not replace authentication, AWS IoT provisioning, or device certificates. Native project folders and release keystores must remain private and are ignored by Git. This repository validates the JavaScript and dependency setup in CI; the final Android build still requires a machine with JDK and Android SDK tooling.

## Live sensor cutover

Keep `MOCK_DATA=true` for the presentation demo. For hardware mode, provision AWS IoT Core certificates privately, set `MOCK_DATA=false`, configure `AWS_IOT_ENDPOINT`, `MQTT_TOPIC`, and `CERT_DIR`, then flash the ESP32 firmware from `firmware/`. Register the device in the authenticated workspace before publishing telemetry in Supabase mode. Never commit certificates, private keys, passwords, service-role keys, or production `.env` files.
