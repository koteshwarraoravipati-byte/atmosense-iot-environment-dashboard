# Atmosense website and mobile app guide

## Website

Atmosense is a responsive IoT environmental monitoring dashboard with a landing page, demo or Supabase-ready authentication, live environmental cards, historical charts, CSV export, device management, configurable alerts, dark mode, and a college presentation page.

Run it from the dashboard folder:

```bash
npm install
copy .env.example .env   # PowerShell; use `cp .env.example .env` in Linux
npm start
```

The included `.env.example` enables sample telemetry. The server loads `.env` automatically. Open `http://localhost:3000`.

## Mobile PWA

The project is a Progressive Web App. Deploy it over HTTPS, open the website on Android Chrome, choose **Install app** or **Add to Home screen**. On iPhone Safari choose **Share → Add to Home Screen**.

A secure HTTPS deployment is required for service-worker installation. Localhost is allowed for development. The mobile layout includes compact navigation, responsive cards, charts, device filters, alert settings, and presentation content.

## Build an Android APK later

The PWA can be wrapped with Capacitor after the web deployment is stable:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init Atmosense com.atmosense.monitor --web-dir public
npx cap add android
npx cap copy android
npx cap open android
```

Build the APK from Android Studio. The Android wrapper packages the website; it does not replace authentication, AWS IoT provisioning, or device certificates.

## Authentication and production data

The default demo uses an Express server, a local JSON user store, salted `scrypt` password hashes, and HttpOnly session cookies. It is suitable for a classroom demo on a private server. Do not publish `dashboard/data/users.json` or runtime telemetry files.

For production, set `AUTH_PROVIDER=supabase`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` in the deployment environment, run `supabase/schema.sql` in the Supabase SQL editor, and configure the Supabase Auth redirect URL. The repository includes the schema and the frontend integration path. The server-side ownership/RLS cutover must be completed before using Supabase with multiple real users.

## Live sensor cutover

Keep `MOCK_DATA=true` for the presentation demo. For hardware mode, provision AWS IoT Core certificates privately, set `MOCK_DATA=false`, configure `AWS_IOT_ENDPOINT`, `MQTT_TOPIC`, and `CERT_DIR`, then flash the ESP32 firmware from `firmware/`. Never commit certificates, private keys, passwords, or production `.env` files.
