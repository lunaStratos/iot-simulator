const mqtt = require('mqtt');
const storage = require('../config/storage');

const serverUrl   = "mqtt://localhost";
const clientId    = "client";
const device_name = "My Node.js MQTT device";
const username    = "";
const password    = "";

module.exports = {

    connect() {
      const client = mqtt.connect(serverUrl, {
        username: username,
        password: password,
        clientId: clientId,
        port: 1883
     });

      client.on("connect", function () {
        console.info('[MQTT] Connected to broker — %s:%d', serverUrl, 1883);

        client.publish("iot/status/1000", "100," + device_name + ",c8y_MQTTDevice", function() {
            client.subscribe("iot/control");
            console.log('[MQTT] Subscribed to iot/control');

            setInterval(function() {
              const device = storage.getDevice(1000);
              if (device) {
                client.publish("iot/status/1000", JSON.stringify(device));
              }
            }, 3000);
        });

      });

      client.on("message", function (topic, message) {
        const json = JSON.parse(message);
        console.log('[MQTT] Control received — deviceId=%s %s=%s', json.deviceId, json.deviceControlName, json.deviceControl);

        const ok = storage.setValue(json.deviceId, json.deviceControlName, json.deviceControl);
        if (!ok) {
            console.error('[MQTT] Control update failed — deviceId=%s', json.deviceId);
            client.publish("iot/status/" + json.deviceId, "error");
        } else {
            client.publish("iot/status/" + json.deviceId, JSON.stringify({status: "ok"}));
        }
      });

      client.on("connect", function () {
        client.publish("iot/status/2000", "100," + device_name + ",c8y_MQTTDevice", function() {
            client.subscribe("iot/control");

            setInterval(function() {
              const device = storage.getDevice(2000);
              if (device) {
                client.publish("iot/status/2000", JSON.stringify(device.json));
              }
            }, 3000);
        });
      });

    }

  };
