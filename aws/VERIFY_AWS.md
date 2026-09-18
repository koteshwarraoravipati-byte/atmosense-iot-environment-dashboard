# AWS IoT and ESP32 verification runbook

This runbook is intentionally manual because it requires the AWS Academy account, physical ESP32, and private certificates. Do not paste certificate contents, passwords, or service-role keys into GitHub.

## 1. Provision and inspect

Run one provisioning script from a private shell:

```bash
./aws/setup-aws.sh
cat secrets/aws-config.json
aws iot get-policy --policy-name iot-env-device-policy --region us-east-1
aws iot get-policy --policy-name iot-env-dashboard-policy --region us-east-1
```

Confirm the policies restrict device/dashboard client IDs and the device publish topic is exactly `environment/dht11`.

## 2. Configure the firmware

Copy `firmware/config.example.h` to `firmware/config.h` outside version control. Fill the Wi-Fi values, endpoint, and device certificate strings. Confirm the MQTT client ID matches the provisioned device thing name. Upload the sketch with the listed Arduino libraries.

Expected serial output:

- Wi-Fi connected and an IP address printed.
- MQTT connected.
- A JSON payload printed every five seconds.
- `DHT11 read failed` only when wiring or sensor power needs attention.

## 3. Validate the dashboard subscriber

Copy only the dashboard certificate files into the private `CERT_DIR`, then configure:

```dotenv
MOCK_DATA=false
AWS_IOT_ENDPOINT=your-endpoint.iot.us-east-1.amazonaws.com
MQTT_TOPIC=environment/dht11
CERT_DIR=../secrets
```

Start the dashboard and inspect the server logs for `Connected to AWS IoT Core`. The dashboard certificate must be the separate subscriber certificate, not the device certificate.

## 4. Validate Supabase mode

For multi-user mode, run `supabase/schema.sql`, configure Supabase Auth, and set the private server variable `SUPABASE_SERVICE_ROLE_KEY`. Register the device from the authenticated dashboard before the first physical reading. Unregistered device IDs are rejected by the ingestion path.

Test with two accounts:

1. Account A registers a device and receives telemetry.
2. Account B cannot see or modify Account A's device, telemetry, or alert settings.
3. Expire or revoke Account A's token and confirm protected requests return `401`.
4. Confirm the service-role key is absent from browser responses and repository files.

## 5. Capture evidence

Capture the wiring, OLED, AWS IoT MQTT test client, live dashboard, history chart, threshold alert, and two-user RLS isolation result. Add evidence to the project report only after the physical run has actually passed.

## 6. Clean up

Stop temporary compute and remove unused certificates, policies, things, and test data after evaluation. Keep signing keystores and production secrets outside the repository.
