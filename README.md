# Atmosense — IoT Environmental Intelligence

Atmosense is a responsive IoT environmental monitoring website for ESP32, DHT11, SSD1306 OLED, AWS IoT Core, MQTT over TLS, historical charts, configurable alerts, and multiple-device management.

## Live demo

Public sample-data dashboard: https://atmosense-iot-environment-dashboard.onrender.com

The public demo is intentionally labelled as sample mode until the physical ESP32 and private AWS certificates are connected.

## Current website capabilities

- Public landing page and product explanation.
- Demo authentication with salted scrypt hashes, or Supabase Auth with validated bearer tokens.
- User-scoped devices, telemetry, and alert settings when Supabase mode is enabled.
- Live temperature and humidity cards through Server-Sent Events in demo mode and authenticated polling in Supabase mode.
- Timestamped JSON history fallback with 1H, 24H, 7D, and All range controls.
- Minimum, maximum, average, and reading-count summaries.
- CSV export for project evidence and analysis.
- Multiple named devices with locations, types, online state, and last-seen values.
- Configurable temperature and humidity threshold alerts.
- Security headers, secure production cookies, request-size limits, rate-limited demo login/signup, and input validation.
- Dark mode with a persisted browser preference.
- Responsive PWA experience for desktop and mobile.
- College presentation guide and browser-readable project report at `/project-report.html`.
- Node test suite and GitHub Actions CI for syntax checks and protected API flows.

## Hardware request list

| Required | Quantity | Purpose |
|---|---:|---|
| ESP32 DevKit V1 / NodeMCU-32S | 1 | Wi-Fi microcontroller and MQTT client |
| DHT11 sensor module | 1 | Temperature and relative-humidity sensor |
| 0.96-inch OLED SSD1306 I²C, 128×64 | 1 | Local display |
| Breadboard | 1 | Prototyping |
| Male-to-male Dupont jumper wires | 8–12 | Connections |
| Micro-USB data cable | 1 | Power and programming |
| 10 kΩ resistor | 1 | DHT11 pull-up if using a bare sensor, not needed for most modules |
| USB 5 V phone charger or powered USB hub | 1 | Stable power during demonstration |

## Wiring

DHT11: VCC→3V3, DATA→GPIO4, GND→GND. OLED: VCC→3V3, GND→GND, SDA→GPIO21, SCL→GPIO22. If your OLED uses address 0x3D instead of 0x3C, change `OLED_ADDR` in the firmware. Do not power the sensor from 5 V when connecting its data line directly to a 3.3 V ESP32.

## Cloud architecture

`DHT11 → ESP32 → Wi-Fi → AWS IoT Core MQTT/TLS → Node.js subscriber → telemetry history → Server-Sent Events/authenticated polling → Atmosense dashboard`

The device certificate is restricted to connect and publish only to `environment/dht11`. The dashboard uses a separate certificate restricted to connect, subscribe, and receive on that topic. In Supabase mode, the dashboard validates the user's bearer token on every protected request, while the server-side ingestion client writes telemetry using the private service-role key.

## Local setup

```bash
cd dashboard
npm ci
copy .env.example .env   # PowerShell; use cp on Linux/macOS
npm start
```

Open `http://localhost:3000`. The sample dataset is used when `MOCK_DATA=true` or no AWS endpoint is configured.

Run validation before opening a pull request:

```bash
npm run check
npm test
```

## Live AWS IoT setup

1. Use AWS Academy Learner Lab in `us-east-1` and open CloudShell.
2. Run `cd aws && chmod +x setup-aws.sh && ./setup-aws.sh` from the project root.
3. Keep generated certificates and private keys in a private `secrets` folder.
4. Copy `firmware/config.example.h` to `firmware/config.h`, fill Wi-Fi and certificate values, and upload to ESP32.
5. Configure the Node.js dashboard with `MOCK_DATA=false`, `AWS_IOT_ENDPOINT`, `MQTT_TOPIC`, and private dashboard certificates.
6. Validate OLED, MQTT, dashboard, history, and alert evidence.

The AWS setup scripts are intentionally idempotent for the named things and policies, but they still create billable/cloud resources. Review the generated `secrets/aws-config.json`, stop unused compute, and delete resources after evaluation.

## Supabase production path

1. Create a Supabase project and enable email authentication.
2. Run `supabase/schema.sql` in the SQL Editor.
3. Set `AUTH_PROVIDER=supabase`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` in the deployment environment.
4. Set `SUPABASE_SERVICE_ROLE_KEY` only on the private server that ingests AWS telemetry; never expose it to the browser or commit it.
5. Register devices through the authenticated dashboard before publishing telemetry for them.
6. Configure the Supabase Auth site URL and redirect URLs for the deployed dashboard.
7. Test signup/login, expired tokens, RLS isolation, device CRUD, history, settings, and logout in a staging project.

The repository keeps the JSON store as a demo fallback. Supabase mode uses RLS for user-owned devices, telemetry reads, and alert settings. Physical AWS and Supabase staging validation are still deployment tasks, not claims made by this repository.

## Android/PWA packaging

The website is installable as a PWA over HTTPS. For an Android wrapper:

```bash
cd dashboard
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npm run cap:sync
npm run cap:android
```

`capacitor.config.json` is checked in with the app ID `com.atmosense.monitor`. Native `android/` and `ios/` directories, signed APKs, and private keystores are intentionally ignored.

## Security notes

Never commit `firmware/config.h`, private keys, certificates, Supabase service-role keys, `.env` files, generated user data, or Android signing keystores. Production deployments must use HTTPS, Supabase Auth, a private ingestion credential, RLS, and a separate staging project before real users or devices are connected.

## College demonstration

Open `/project-report.html` from the deployed site for the abstract, architecture, components, implementation summary, evidence checklist, limitations, and conclusion. Capture the wiring, OLED, MQTT message, live dashboard, history, and alert views during physical validation.

See `DEPLOYMENT_CHECKLIST.md`, `MOBILE_APP_GUIDE.md`, `docs/project-report.md`, and `supabase/schema.sql` for the complete handoff.
