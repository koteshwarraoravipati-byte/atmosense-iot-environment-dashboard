# Atmosense completion checklist

## A. Sample dashboard demo

- [x] Responsive website landing page
- [x] Login and account-creation screens
- [x] Protected workspace shell
- [x] Sample telemetry dataset
- [x] Temperature/humidity cards and trend chart
- [x] Device status and recent readings
- [x] Mobile bottom navigation
- [x] PWA manifest, service worker, and icons

Run privately:

```bash
cd dashboard
npm install
cp .env.example .env
npm start
```

## B. Public website deployment

Choose one target before publishing:

- Render Web Service: best fit because the Node server handles login and MQTT.
- EC2: best fit when keeping AWS IoT credentials inside AWS.
- Vercel: suitable for a static frontend, but the MQTT/auth server must be hosted separately.

Required production environment variables:

- `MOCK_DATA=false`
- `AWS_IOT_ENDPOINT`
- `MQTT_TOPIC=environment/dht11`
- `CERT_DIR` pointing to private certificate files

Do not deploy `dashboard/data/users.json` or private keys to a public repository.

## C. Managed authentication

The current file-backed auth works for a private classroom demo. Before public launch, migrate signup/login to Supabase Auth or Amazon Cognito. Required migration work:

1. Create the auth project.
2. Replace `/api/auth/signup` and `/api/auth/login` with the provider SDK.
3. Use provider sessions instead of the in-memory session map.
4. Keep only profile metadata in a database table.
5. Add email verification and password-reset flows.
6. Test login, logout, expired sessions, and unauthorized dashboard access.

## D. Android app

The website is already PWA-ready. For an APK:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap copy android
npx cap open android
```

Build a debug APK in Android Studio. A signed release APK requires a keystore and should be created by the project owner, not stored in this repository.

## E. Hardware cutover

When the ESP32 and DHT11 are available:

1. Run AWS IoT provisioning.
2. Fill `firmware/config.h` with Wi-Fi and device certificate values.
3. Upload the firmware.
4. Confirm OLED readings.
5. Confirm AWS IoT MQTT messages.
6. Set dashboard `MOCK_DATA=false`.
7. Capture wiring, OLED, MQTT, and dashboard evidence.
8. Fill the results table in `docs/project-report.md`.
