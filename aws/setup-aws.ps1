param(
  [string]$Region = "us-east-1",
  [string]$ThingName = "iot-env-device",
  [string]$DashboardThingName = "iot-env-dashboard"
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $Root "secrets"
New-Item -ItemType Directory -Force -Path $Out | Out-Null

Write-Host "Checking AWS Learner Lab identity..."
$AccountId = aws sts get-caller-identity --query Account --output text
$Endpoint = aws iot describe-endpoint --endpoint-type iot:Data-ATS --region $Region --query endpoint --output text
$DevicePolicyName = "$ThingName-policy"
$DashboardPolicyName = "$DashboardThingName-policy"

$devicePolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["iot:Connect"], "Resource": "arn:aws:iot:${Region}:${AccountId}:client/$ThingName" },
    { "Effect": "Allow", "Action": ["iot:Publish"], "Resource": "arn:aws:iot:${Region}:${AccountId}:topic/environment/dht11" }
  ]
}
"@
$dashboardPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["iot:Connect"], "Resource": "arn:aws:iot:${Region}:${AccountId}:client/$DashboardThingName" },
    { "Effect": "Allow", "Action": ["iot:Subscribe"], "Resource": "arn:aws:iot:${Region}:${AccountId}:topicfilter/environment/dht11" },
    { "Effect": "Allow", "Action": ["iot:Receive"], "Resource": "arn:aws:iot:${Region}:${AccountId}:topic/environment/dht11" }
  ]
}
"@
$devicePolicyFile = Join-Path $Out "device-policy.json"; $devicePolicy | Set-Content -Encoding ascii $devicePolicyFile
$dashboardPolicyFile = Join-Path $Out "dashboard-policy.json"; $dashboardPolicy | Set-Content -Encoding ascii $dashboardPolicyFile

aws iot create-thing --thing-name $ThingName --region $Region 2>$null | Out-Null
aws iot create-thing --thing-name $DashboardThingName --region $Region 2>$null | Out-Null
aws iot create-policy --policy-name $DevicePolicyName --policy-document file://$devicePolicyFile --region $Region 2>$null | Out-Null
aws iot create-policy --policy-name $DashboardPolicyName --policy-document file://$dashboardPolicyFile --region $Region 2>$null | Out-Null

function New-Certificate($prefix, $thing, $policy) {
  $certFile = Join-Path $Out "$prefix-certificate.pem.crt"
  $keyFile = Join-Path $Out "$prefix-private.pem.key"
  if ((Test-Path $certFile) -and (Test-Path $keyFile)) { return }
  $certJson = Join-Path $Out "$prefix-certificate.json"
  aws iot create-keys-and-certificate --set-as-active --region $Region --output json | Set-Content -Encoding utf8 $certJson
  $cert = Get-Content $certJson -Raw | ConvertFrom-Json
  $cert.certificatePem | Set-Content -Encoding ascii $certFile
  $cert.keyPair.PrivateKey | Set-Content -Encoding ascii $keyFile
  aws iot attach-policy --policy-name $policy --target $cert.certificateArn --region $Region
  aws iot attach-thing-principal --thing-name $thing --principal $cert.certificateArn --region $Region
  Remove-Item $certJson -Force
}

New-Certificate "device" $ThingName $DevicePolicyName
New-Certificate "dashboard" $DashboardThingName $DashboardPolicyName
$rootCa = Join-Path $Out "AmazonRootCA1.pem"
if (!(Test-Path $rootCa)) { Invoke-WebRequest -Uri "https://www.amazontrust.com/repository/AmazonRootCA1.pem" -OutFile $rootCa }

@{
  region = $Region
  endpoint = $Endpoint
  topic = "environment/dht11"
  deviceThing = $ThingName
  dashboardThing = $DashboardThingName
} | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $Out "aws-config.json")

Write-Host "Provisioning complete. Secrets saved locally in: $Out"
Write-Host "Endpoint: $Endpoint"
Write-Host "Next: configure firmware/config.h and dashboard/.env."
