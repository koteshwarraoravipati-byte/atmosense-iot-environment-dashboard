# IoT Environmental Dashboard — Project Report Draft

## 1. Abstract

This project implements a low-cost environmental monitoring system. A DHT11 sensor measures temperature and relative humidity. An ESP32 reads the sensor, shows the latest values on an SSD1306 OLED, and securely publishes JSON telemetry to AWS IoT Core using MQTT over TLS. A Node.js cloud subscriber receives the telemetry and streams it to a browser dashboard for live monitoring.

## 2. Objectives

- Measure real temperature and humidity.
- Display readings locally on an OLED.
- Transfer telemetry to a cloud service.
- Visualize current and recent values in a browser.
- Apply certificate-based authentication and least-privilege MQTT policies.

## 3. Components

ESP32 DevKit, DHT11, SSD1306 I²C OLED, breadboard, jumper wires, USB cable, optional 10 kΩ pull-up resistor, and AWS Academy Learner Lab.

## 4. Methodology

The ESP32 connects to Wi-Fi and authenticates to AWS IoT Core with an X.509 device certificate. Every five seconds it reads the DHT11 and publishes a JSON message to `environment/dht11`. The cloud subscriber authenticates with a separate certificate, subscribes to the topic, stores the most recent readings in memory, and sends them to connected browsers through Server-Sent Events.

## 5. Sample telemetry format

```json
{"device_id":"iot-env-device","temperature_c":28.4,"humidity_percent":61.0,"rssi_dbm":-57,"timestamp_ms":125000}
```

## 6. Results

After hardware validation, insert the measured values here. Include the wiring photograph, OLED screenshot, MQTT test-client screenshot, and dashboard screenshot. Report at least five readings collected at different times and compare the OLED value with the dashboard value.

| Time | OLED temperature | Dashboard temperature | OLED humidity | Dashboard humidity |
|---|---:|---:|---:|---:|
| Fill after test | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

## 7. Security and cost controls

TLS protects communication between the device and AWS IoT Core. Separate certificates are used for the device and dashboard. The device can publish only to the sensor topic, while the dashboard can subscribe and receive only from that topic. The AWS Academy EC2 instance should be stopped when not being demonstrated, and unused IoT resources should be removed after evaluation.

## 8. Limitations and future work

DHT11 has limited accuracy and slow sampling compared with higher-grade sensors. The current dashboard stores recent readings in memory, so a production version could add DynamoDB or Timestream, user authentication, alerts, multiple devices, and historical charts. These additions are not required for the core demonstration.

## 9. Conclusion

The system demonstrates the complete IoT-to-cloud path: physical sensing, local visualization, secure MQTT communication, cloud ingestion, and browser-based monitoring. The architecture is modular and can be extended with more sensors and devices.
