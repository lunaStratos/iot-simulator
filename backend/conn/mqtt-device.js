// MQTT dependency https://github.com/mqttjs/MQTT.js
const mqtt = require("mqtt");

// client, user and device details
const serverUrl   = "mqtt://localhost";
const clientId    = "client";
const device_name = "My Node.js MQTT device";
const username    = "123";
const password    = "123";

var temperature   = 25;

// connect the client to Cumulocity IoT
const client = mqtt.connect(serverUrl, {
    username: username,
    password: password,
    clientId: clientId,
    port: 1883
});

// once connected...
client.on("connect", function () {
    // ...register a new device with restart operation
    client.publish("common/in", "100," + device_name + ",c8y_MQTTDevice", function() {
        client.publish("common/in", "114,c8y_Restart", function() {
            console.log("Device registered with restart operation support");
        });

        // listen for operations
        client.subscribe("s/ds");

        // send a temperature measurement every 3 seconds
        setInterval(function() {
            console.log("Sending temperature measurement: " + temperature + "º");
            client.publish("common/in", "" + temperature);
            temperature += getRandom(1, 10) - getRandom(1, 10);
        }, 3000);
    });

    console.log("\nUpdating hardware information...");
    client.publish("common/in", "110,S123456789,MQTT test model,Rev0.1");
});

// display all incoming messages
client.on("message", function (topic, message) {
    console.log('Received operation "' + message + '"');
    if (message.toString().indexOf("510") == 0) {
        console.log("Simulating device restart...");
        client.publish("common/in", "501,c8y_Restart");
        console.log("...restarting...");
        setTimeout(function() {
            client.publish("common/in", "503,c8y_Restart");
            console.log("...done...");
        }, 1000);
    }
});

function getRandom(min, max)
{
	return Math.floor(Math.random() * (max - min + 1) + min);
}