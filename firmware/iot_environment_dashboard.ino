#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "config.h"

#define DHTPIN 4
#define DHTTYPE DHT11
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_ADDR 0x3C

DHT dht(DHTPIN, DHTTYPE);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
WiFiClientSecure secureClient;
PubSubClient mqtt(secureClient);

unsigned long lastPublish = 0;
const unsigned long PUBLISH_INTERVAL_MS = 5000;

void showMessage(const String &line1, const String &line2 = "") {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 12); display.println(line1);
  display.setCursor(0, 30); display.println(line2);
  display.display();
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  showMessage("Connecting WiFi", WIFI_SSID);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();
  Serial.println(WiFi.localIP());
}

void connectMQTT() {
  while (!mqtt.connected()) {
    showMessage("Connecting AWS IoT", MQTT_CLIENT_ID);
    Serial.print("Connecting MQTT...");
    if (mqtt.connect(MQTT_CLIENT_ID)) {
      Serial.println("connected");
      showMessage("AWS IoT connected", "Publishing data");
    } else {
      Serial.printf("failed, rc=%d\n", mqtt.state());
      delay(3000);
    }
  }
}

void showReading(float temperature, float humidity) {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0); display.println("IoT Environment");
  display.setTextSize(2);
  display.setCursor(0, 17); display.printf("T %.1f C", temperature);
  display.setCursor(0, 42); display.printf("H %.1f %%", humidity);
  display.display();
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  Wire.begin(21, 22);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("OLED not found; continuing without display");
  } else {
    showMessage("IoT Environment", "Starting...");
  }

  connectWiFi();
  secureClient.setCACert(AWS_ROOT_CA);
  secureClient.setCertificate(DEVICE_CERT);
  secureClient.setPrivateKey(DEVICE_PRIVATE_KEY);
  mqtt.setServer(AWS_IOT_ENDPOINT, 8883);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  if (millis() - lastPublish >= PUBLISH_INTERVAL_MS) {
    lastPublish = millis();
    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();
    if (isnan(humidity) || isnan(temperature)) {
      Serial.println("DHT11 read failed");
      showMessage("DHT11 read failed", "Check wiring");
      return;
    }

    showReading(temperature, humidity);
    String payload = String("{\"device_id\":\"") + MQTT_CLIENT_ID +
      "\",\"temperature_c\":" + String(temperature, 1) +
      ",\"humidity_percent\":" + String(humidity, 1) +
      ",\"rssi_dbm\":" + String(WiFi.RSSI()) +
      ",\"timestamp_ms\":" + String(millis()) + "}";
    Serial.println(payload);
    mqtt.publish(MQTT_TOPIC, payload.c_str());
  }
}