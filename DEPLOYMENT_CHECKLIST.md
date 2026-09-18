# Atmosense completion checklist

## A. Website and demo experience — implemented

- [x] Responsive website landing page
- [x] Login and account-creation screens
- [x] Protected workspace shell
- [x] Sample telemetry dataset
- [x] Temperature/humidity cards and trend chart
- [x] Persistent JSON history fallback
- [x] 1H / 24H / 7D / All history controls
- [x] Range and average summaries
- [x] CSV export
- [x] Device management view
- [x] Configurable temperature and humidity alerts
- [x] Dark mode
- [x] College presentation view and project report page
- [x] PWA manifest, service worker, and icons
- [x] Supabase bearer-token validation in protected server routes
- [x] Supabase RLS-aware device, telemetry, and alert-setting access
- [x] Security headers, secure production cookies, rate limiting, request limits, and input validation
- [x] Automated Node tests and GitHub Actions CI
- [x] Capacitor configuration and Android packaging instructions

## B. Public demo deployment

The public Render service is intentionally configured with `MOCK_DATA=true` until the hardware and certificates are ready. It is a working sample-data demonstration, not a live sensor deployment.

Required live-data environment variables:

- `MOCK_DATA=false`
- `AWS_IOT_ENDPOINT`
- `MQTT_TOPIC=environment/dht11`
- `CERT_DIR` pointing to private certificate files

Never commit certificates, private keys, `users.json`, private Supabase keys, or signing keystores.

## C. Real ESP32/AWS IoT cutover — requires physical/cloud validation

- [ ] Run `aws/setup-aws.sh` or `aws/setup-aws.ps1` from a private AWS CloudShell/PowerShell session.
- [ ] Copy the generated endpoint and certificates into private local/Render configuration.
- [ ] Fill `firmware/config.h` with Wi-Fi and device certificate values.
- [ ] Upload the firmware to ESP32.
- [ ] Confirm OLED readings.
- [ ] Confirm AWS IoT MQTT messages on `environment/dht11`.
- [ ] Configure the dashboard's private certificate files.
- [ ] Set `MOCK_DATA=false` and redeploy.
- [ ] Confirm the dashboard receives the physical device stream.
- [ ] Capture wiring, OLED, MQTT, dashboard, history, and alert evidence.
- [ ] Stop/delete temporary AWS resources after evaluation.

## D. Managed authentication and database — code prepared; staging validation required

- [x] Supabase schema with owner foreign keys and RLS policies
- [x] Supabase client bearer-token validation
- [x] User-scoped device/history/settings API paths
- [x] Private service-role ingestion path that resolves a registered device owner
- [ ] Create a Supabase staging project and run `supabase/schema.sql`.
- [ ] Enable email authentication and configure site/redirect URLs.
- [ ] Set `AUTH_PROVIDER=supabase`, public URL/key, and private service-role key.
- [ ] Test login, logout, expired sessions, RLS isolation, and unauthorized dashboard access.
- [ ] Verify telemetry ingestion and retention in staging.
- [ ] Add email verification and password reset UI if required by the deployment.

## E. Android/PWA

- [x] PWA manifest and service worker
- [x] `dashboard/capacitor.config.json`
- [x] Android packaging commands and signing guidance
- [ ] Install Capacitor dependencies and generate the native Android project.
- [ ] Test the wrapper against the deployed HTTPS dashboard.
- [ ] Build and sign a release APK with a private keystore.
