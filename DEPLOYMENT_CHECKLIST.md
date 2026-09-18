# Atmosense completion checklist

## A. Website and demo experience

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

## B. Public demo deployment

The public Render service is intentionally configured with `MOCK_DATA=true` until the hardware and certificates are ready. It is a working sample-data demonstration, not a live sensor deployment.

Required live-data environment variables:

- `MOCK_DATA=false`
- `AWS_IOT_ENDPOINT`
- `MQTT_TOPIC=environment/dht11`
- `CERT_DIR` pointing to private certificate files

Never commit certificates, private keys, `users.json`, or private Supabase keys.

## C. Real ESP32/AWS IoT cutover

1. Run `aws/setup-aws.sh` from a private AWS CloudShell session.
2. Copy the generated endpoint and certificates into private local/Render configuration.
3. Fill `firmware/config.h` with Wi-Fi and device certificate values.
4. Upload the firmware to ESP32.
5. Confirm OLED readings.
6. Confirm AWS IoT MQTT messages on `environment/dht11`.
7. Configure the dashboard's private certificate files.
8. Set `MOCK_DATA=false` and redeploy.
9. Confirm the dashboard receives the physical device stream.
10. Capture wiring, OLED, MQTT, dashboard, history, and alert evidence.

## D. Managed authentication and database

The app is Supabase-ready. For public multi-user production:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL Editor.
3. Enable email authentication.
4. Set `AUTH_PROVIDER=supabase`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`.
5. Connect telemetry ingestion to Supabase/Postgres using a private server-side credential.
6. Migrate device/history endpoints to owner-scoped queries.
7. Add email verification and password reset.
8. Test login, logout, expired sessions, RLS, and unauthorized dashboard access.

## E. Android/PWA

The website can be installed as a PWA over HTTPS. For an APK, use Capacitor after the web deployment is stable. A signed release APK requires a private keystore that must not be stored in this repository.
