#!/usr/bin/env bash
set -euo pipefail
REGION="${AWS_REGION:-us-east-1}"
THING_NAME="${THING_NAME:-iot-env-device}"
DASHBOARD_THING_NAME="${DASHBOARD_THING_NAME:-iot-env-dashboard}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/secrets"
mkdir -p "$OUT"

command -v aws >/dev/null || { echo "AWS CLI is required in CloudShell"; exit 1; }
command -v jq >/dev/null || { echo "jq is required in CloudShell"; exit 1; }
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ENDPOINT=$(aws iot describe-endpoint --endpoint-type iot:Data-ATS --region "$REGION" --query endpoint --output text)
TOPIC="environment/dht11"
DEVICE_POLICY_NAME="$THING_NAME-policy"
DASHBOARD_POLICY_NAME="$DASHBOARD_THING_NAME-policy"

cat > "$OUT/device-policy.json" <<EOF
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["iot:Connect"],"Resource":["arn:aws:iot:$REGION:$ACCOUNT_ID:client/*"]},{"Effect":"Allow","Action":["iot:Publish"],"Resource":["arn:aws:iot:$REGION:$ACCOUNT_ID:topic/$TOPIC"]}]}
EOF
cat > "$OUT/dashboard-policy.json" <<EOF
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["iot:Connect"],"Resource":["arn:aws:iot:$REGION:$ACCOUNT_ID:client/*"]},{"Effect":"Allow","Action":["iot:Subscribe"],"Resource":["arn:aws:iot:$REGION:$ACCOUNT_ID:topicfilter/$TOPIC"]},{"Effect":"Allow","Action":["iot:Receive"],"Resource":["arn:aws:iot:$REGION:$ACCOUNT_ID:topic/$TOPIC"]}]}
EOF

aws iot create-thing --thing-name "$THING_NAME" --region "$REGION" >/dev/null 2>&1 || true
aws iot create-thing --thing-name "$DASHBOARD_THING_NAME" --region "$REGION" >/dev/null 2>&1 || true
aws iot create-policy --policy-name "$DEVICE_POLICY_NAME" --policy-document "file://$OUT/device-policy.json" --region "$REGION" >/dev/null 2>&1 || true
aws iot create-policy --policy-name "$DASHBOARD_POLICY_NAME" --policy-document "file://$OUT/dashboard-policy.json" --region "$REGION" >/dev/null 2>&1 || true

create_cert() {
  local prefix="$1" thing="$2" policy="$3"
  local json="$OUT/$prefix-certificate.json"
  aws iot create-keys-and-certificate --set-as-active --region "$REGION" --output json > "$json"
  local arn id
  arn=$(jq -r '.certificateArn' "$json")
  id=$(jq -r '.id' "$json")
  jq -r '.certificatePem' "$json" > "$OUT/$prefix-certificate.pem.crt"
  jq -r '.keyPair.PrivateKey' "$json" > "$OUT/$prefix-private.pem.key"
  aws iot attach-policy --policy-name "$policy" --target "$arn" --region "$REGION"
  aws iot attach-thing-principal --thing-name "$thing" --principal "$arn" --region "$REGION"
  rm -f "$json"
}

if [[ ! -f "$OUT/device-certificate.pem.crt" ]]; then create_cert device "$THING_NAME" "$DEVICE_POLICY_NAME"; fi
if [[ ! -f "$OUT/dashboard-certificate.pem.crt" ]]; then create_cert dashboard "$DASHBOARD_THING_NAME" "$DASHBOARD_POLICY_NAME"; fi
curl -fsSL https://www.amazontrust.com/repository/AmazonRootCA1.pem -o "$OUT/AmazonRootCA1.pem"
printf '{"region":"%s","endpoint":"%s","topic":"%s","deviceThing":"%s","dashboardThing":"%s"}\n' "$REGION" "$ENDPOINT" "$TOPIC" "$THING_NAME" "$DASHBOARD_THING_NAME" > "$OUT/aws-config.json"
echo "Provisioning complete. Endpoint: $ENDPOINT"
echo "Secrets are in: $OUT"
