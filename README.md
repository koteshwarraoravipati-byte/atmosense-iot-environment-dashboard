# IoT Environmental Dashboard

A complete cloud-computing project in which an ESP32 reads real temperature and humidity from a DHT11, shows the values on an SSD1306 OLED, publishes telemetry securely to AWS IoT Core over MQTT/TLS, and displays live readings in a browser dashboard.

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

Recommended spares: one extra DHT11 module, one extra USB cable, and a small 330 Ω resistor assortment. Do not power the sensor from 5 V when connecting its data line directly to a 3.3 V ESP32.

## Wiring

DHT11: VCC→3V3, DATA→GPIO4, GND→GND. OLED: VCC→3V3, GND→GND, SDA→GPIO21, SCL→GPIO22. If your OLED uses address 0x3D instead of 0x3C, change `OLED_ADDR` in the firmware.

## Cloud architecture

`DHT11 → ESP32 → Wi-Fi → AWS IoT Core MQTT/TLS → Node.js subscriber on EC2 → Server-Sent Events → Browser dashboard`.

The device certificate is restricted to connect and publish only to `environment/dht11`. The dashboard uses a separate certificate restricted to connect, subscribe, and receive on that topic. This is the least-privilege boundary for the demonstration.

## Setup

1. Use AWS Academy Learner Lab in `us-east-1`. Start the lab and open **CloudShell** from the AWS console.
2. Upload this project ZIP to CloudShell and extract it, or copy the project folder there. The `aws/setup-aws.sh` script is for CloudShell; `setup-aws.ps1` is for Windows PowerShell.
3. In CloudShell run `cd iot-environment-dashboard/aws && chmod +x setup-aws.sh && ./setup-aws.sh`. It creates the IoT things, least-privilege policies, certificates, private keys, downloads `AmazonRootCA1.pem`, and records the endpoint. Never upload the `secrets` folder to GitHub.
4. Copy `firmware/config.example.h` to `firmware/config.h`; paste the endpoint, Wi-Fi values, and device certificate/private key from `secrets`.
5. Install the Arduino libraries listed in `firmware/README.md`, select ESP32, compile, upload, and open Serial Monitor at 115200.
6. For a local dashboard: `cd dashboard; npm install; copy .env.example .env`; set the endpoint and `CERT_DIR=../secrets`, then run `npm start`. Open `http://localhost:3000`.
7. For an EC2 demo, install Node.js on a small Amazon Linux instance, copy `dashboard` and the three dashboard certificate files plus `AmazonRootCA1.pem`, run `npm install`, set environment variables, and start with `npm start`. Open TCP port 3000 in the instance's security group only for the demo, then remove the rule after evaluation.

### CloudShell upload shortcut

In CloudShell choose **Actions → Upload file**, upload the ZIP, then run `unzip iot-environment-dashboard.zip`. If `unzip` is unavailable, use `python3 -m zipfile -e iot-environment-dashboard.zip .`.

### Important certificate note

The script generates private keys and certificates. Keep them only in the private `secrets` folder. Do not paste private keys into chat, reports, screenshots, or public repositories.

## Website, login, and mobile app

The dashboard is now a responsive product website named **Atmosense**. It includes a public landing page, login page, account creation page, protected monitoring workspace, live cards, environmental trend chart, connected-device area, history area, and mobile bottom navigation.

Signup and login work through the Express server using salted `scrypt` password hashes and HttpOnly session cookies. This local file-backed authentication is suitable for a classroom/private deployment. For public production, migrate authentication to Supabase Auth, Amazon Cognito, or another managed provider.

The website is also an installable Progressive Web App. Deploy it over HTTPS, open it on Android Chrome or iPhone Safari, and choose **Install app** or **Add to Home Screen**. See `MOBILE_APP_GUIDE.md` for the APK wrapper path using Capacitor.

## Safe test without hardware

Copy `dashboard/.env.example` to `dashboard/.env` and run the dashboard. The included sample dataset contains realistic, visibly labelled readings from `demo-esp32-dht11`, which are cycled through the dashboard for presentation before the ESP32 is available. The final demonstration must use `MOCK_DATA=false` and show real DHT11 values.

## Evidence for the project demonstration

Capture: (1) wiring photograph, (2) OLED showing temperature/humidity, (3) AWS IoT MQTT test client showing a live JSON message, (4) dashboard with changing readings, (5) architecture diagram, and (6) a short table containing time, temperature, humidity, and device ID.

## Troubleshooting

- MQTT connection rejected: verify endpoint, certificate, private key, system time, policy attachment, and that the device client ID is unique.
- DHT11 shows NaN: check DATA/GND, wait two seconds after power-up, and use the 10 kΩ pull-up for a bare sensor.
- OLED blank: scan I²C address; try 0x3D instead of 0x3C and confirm SDA/SCL.
- Dashboard has no data: verify `AmazonRootCA1.pem`, dashboard certificate filenames, topic name, and that the dashboard policy includes Subscribe and Receive.
- AWS Academy budget: stop EC2 when not demonstrating and delete the IoT certificates/things when the course is finished if they are no longer needed.
