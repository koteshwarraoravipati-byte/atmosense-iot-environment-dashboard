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

## 3. System architecture

`DHT11 → ESP32 → Wi-Fi → AWS IoT Core MQTT/TLS → Node.js ingestion → telemetry storage → Atmosense dashboard`

The device certificate is restricted to connect and publish only to `environment/dht11`. The dashboard uses a separate certificate restricted to connect, subscribe, and receive on that topic. This is the least-privilege boundary for the demonstration.

## 4. Components

ESP32 DevKit, DHT11, SSD1306 I²C OLED, breadboard, jumper wires, USB cable, optional 10 kΩ pull-up resistor, AWS Academy Learner Lab, Node.js, Express, MQTT, and a modern browser.

## 5. Implemented website features

- Public Atmosense landing page.
- Demo or Supabase-ready authentication boundary.
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
- College presentation view and browser-readable project report.

## 6. Sample telemetry format

```json
{"device_id":"iot-env-device","temperature_c":28.4,"humidity_percent":61.0,"rssi_dbm":-57,"timestamp_ms":125000}
```

## 7. Results and evidence

During the final physical validation, capture the following:

1. Wiring photograph.
2. OLED showing temperature and humidity.
3. AWS IoT MQTT test client showing a live JSON message.
4. Dashboard with changing live readings.
5. History chart and alert threshold screenshot.
6. Architecture diagram.
7. A table containing at least five readings and device IDs.

| Time | OLED temperature | Dashboard temperature | OLED humidity | Dashboard humidity |
|---|---:|---:|---:|---:|
| Fill after test | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

## 8. Security, authentication, and cost controls

TLS protects communication between the device and AWS IoT Core. Separate certificates are used for the device and dashboard. Private certificates, keys, Supabase service-role keys, and user data are excluded from the public repository. The classroom fallback uses salted scrypt password hashes and HttpOnly sessions. For public multi-user use, run `supabase/schema.sql`, configure Supabase Auth, and use row-level security with managed telemetry storage.

The AWS Academy EC2 instance should be stopped when not being demonstrated, and unused IoT resources should be removed after evaluation. Render Free may sleep after inactivity.

## 9. Limitations and future work

DHT11 has limited accuracy and slow sampling compared with higher-grade sensors. The JSON persistence layer is a safe demo fallback, not a horizontally scalable database. The next production hardening step is to route telemetry and user-owned devices through Supabase/Postgres or an AWS-managed telemetry store, add email/push alert delivery, rate-limit auth endpoints, and complete physical ESP32 validation.

## 10. Conclusion

Atmosense demonstrates the complete IoT-to-cloud path: physical sensing, local visualization, secure MQTT communication, timestamped data storage, historical analysis, alerting, device organization, and browser-based monitoring. The architecture remains modular and can be extended with more sensors and locations.
