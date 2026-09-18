# Atmosense — IoT Environmental Intelligence Project Report

## 1. Abstract

Atmosense is a low-cost environmental monitoring system. A DHT11 sensor measures temperature and relative humidity. An ESP32 reads the sensor, shows the latest values on an SSD1306 OLED, and securely publishes JSON telemetry to AWS IoT Core using MQTT over TLS. A Node.js service receives telemetry and exposes a responsive browser dashboard with persistent history, trend charts, device management, CSV export, configurable alerts, and a college demonstration guide.

The public deployment begins in clearly labelled sample-data mode. The same codebase is prepared for the real ESP32/AWS IoT cutover without exposing certificates or private keys.

## 2. Objectives

- Measure real temperature and humidity.
- Display readings locally on an OLED.
- Transfer telemetry securely to a cloud service.
- Store timestamped readings for historical analysis.
- Visualize current and historical values in a browser and PWA.
- Support multiple named devices and locations.
- Detect configurable temperature and humidity threshold violations.
- Apply certificate-based authentication and least-privilege MQTT policies.
- Provide a clear project presentation and evidence checklist.
- Protect multi-user data with validated sessions and owner-scoped access.

## 3. System architecture

`DHT11 → ESP32 → Wi-Fi → AWS IoT Core MQTT/TLS → Node.js ingestion → telemetry storage → authenticated dashboard`

The device certificate is restricted to connect and publish only to `environment/dht11`. The dashboard uses a separate certificate restricted to connect, subscribe, and receive on that topic. In Supabase mode, the browser uses Supabase Auth, protected API routes validate bearer tokens, and RLS scopes devices, telemetry, and alert settings by `auth.uid()`.

## 4. Components

ESP32 DevKit, DHT11, SSD1306 I²C OLED, breadboard, jumper wires, USB cable, optional 10 kΩ pull-up resistor, AWS Academy Learner Lab, Node.js, Express, MQTT, Supabase Auth/Postgres, and a modern browser.

## 5. Implemented website features

- Public Atmosense landing page.
- Demo or Supabase-ready authentication boundary.
- Supabase bearer-token validation for protected API routes.
- Owner-scoped device, telemetry, and alert-setting access with RLS.
- Live temperature and humidity cards.
- Persistent JSON telemetry history for the classroom deployment.
- 1-hour, 24-hour, 7-day, and all-time range controls.
- Minimum, maximum, average, and reading-count summaries.
- CSV export.
- Multiple-device list with names, locations, types, online state, and last-seen time.
- Configurable temperature and humidity thresholds.
- Alert view showing recent warnings.
- Dark mode with persisted browser preference.
- Responsive PWA layout for desktop and mobile.
- Security headers, secure production cookies, rate-limited demo auth, request limits, and input validation.
- Automated tests and GitHub Actions CI.
- College presentation view and browser-readable project report.

## 6. Sample telemetry format

```json
{"device_id":"iot-env-device","temperature_c":28.4,"humidity_percent":61.0,"rssi_dbm":-57,"timestamp_ms":125000}
```

## 7. Results and evidence

Physical validation remains to be completed with the actual ESP32, OLED, AWS account, and deployment environment. Capture the following during the final test:

1. Wiring photograph.
2. OLED showing temperature and humidity.
3. AWS IoT MQTT test client showing a live JSON message.
4. Dashboard with changing live readings.
5. History chart and alert threshold screenshot.
6. Architecture diagram.
7. A table containing at least five readings and device IDs.
8. Supabase staging evidence showing two users cannot read each other's devices or telemetry.
9. Android/PWA installation evidence if a mobile deliverable is required.

| Time | OLED temperature | Dashboard temperature | OLED humidity | Dashboard humidity |
|---|---:|---:|---:|---:|
| Fill after test | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

## 8. Security, authentication, and cost controls

TLS protects communication between the device and AWS IoT Core. Separate certificates are used for the device and dashboard. Private certificates, keys, Supabase service-role keys, user data, and Android signing keystores are excluded from the public repository. The classroom fallback uses salted scrypt password hashes and HttpOnly sessions. Production mode validates Supabase bearer tokens and relies on RLS for owner isolation. The private ingestion path uses the service-role key only on the server and accepts telemetry only for registered devices.

The AWS Academy EC2 instance should be stopped when not being demonstrated, and unused IoT resources should be removed after evaluation. Render Free may sleep after inactivity. Supabase staging should be used to verify RLS before real users are onboarded.

## 9. Limitations and future work

DHT11 has limited accuracy and slow sampling compared with higher-grade sensors. The JSON persistence layer is a safe demo fallback, not a horizontally scalable database. Remaining delivery work is physical ESP32 validation, AWS/Supabase staging verification, optional email verification/password reset UI, and Android release signing. Further production hardening may add distributed rate limiting, telemetry retention policies, and alert delivery through email or push notifications.

## 10. Conclusion

Atmosense demonstrates the complete IoT-to-cloud path: physical sensing, local visualization, secure MQTT communication, timestamped data storage, historical analysis, alerting, device organization, authenticated multi-user monitoring, and browser-based monitoring. The architecture remains modular and can be extended with more sensors and locations.
