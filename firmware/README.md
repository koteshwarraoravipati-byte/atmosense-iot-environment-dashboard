# ESP32 firmware

## Libraries
Install these Arduino IDE libraries:
- DHT sensor library by Adafruit
- Adafruit Unified Sensor
- Adafruit GFX Library
- Adafruit SSD1306
- PubSubClient

Select an ESP32 board and upload after copying `config.example.h` to `config.h` and inserting the generated certificates.

## Wiring
| Part | ESP32 |
|---|---|
| DHT11 VCC | 3V3 |
| DHT11 DATA | GPIO 4 |
| DHT11 GND | GND |
| OLED VCC | 3V3 |
| OLED GND | GND |
| OLED SDA | GPIO 21 |
| OLED SCL | GPIO 22 |

For a bare 4-pin DHT11, add a 10 kΩ pull-up resistor between DATA and 3V3. Many modules already include it.

## Test
Open Serial Monitor at 115200 baud. Every five seconds the device should display the reading on the OLED and publish JSON to `environment/dht11`.