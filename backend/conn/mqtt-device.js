const mqtt = require('mqtt');
const mysql = require('../config/database')();
const conn = mysql.init();

// client, user and device details
const serverUrl   = "mqtt://localhost";
const clientId    = "client";
const device_name = "My Node.js MQTT device";
const username    = "";
const password    = "";
var temperature   = 25;

module.exports = {
    
    connect() {
      // Connect mqtt with credentials (in case of needed, otherwise we can omit 2nd param)
      const client = mqtt.connect(serverUrl, {
        username: username,
        password: password,
        clientId: clientId,
        port: 1883
     });
  
      // once connected...
      client.on("connect", function () {
        // ...register a new device with restart operation
        client.publish("iot/status/1000", "100," + device_name + ",c8y_MQTTDevice", function() {
            // listen for operations
            client.subscribe("iot/control");

            // send a temperature measurement every 3 seconds
            setInterval(function() {
              
                var sql = 'SELECT * FROM iot_boiler WHERE id = 1000';
                conn.query(sql, [], function (err, rows, fields) {
                    if(err) console.log('query is not excuted. select fail...\n' + err);
                    console.log("Sending temperature measurement: " + rows[0] + "º");
                    client.publish("iot/status/1000", "" + rows[0].now_temperature);
                });
            }, 3000);
        });

      });

      // display all incoming messages
      client.on("message", function (topic, message) {
        console.log('Received operation "' + message + '"');

        const json = JSON.parse(message);
        const deviceId = json.deviceId;
        const deivceControl = json.deivceControl;
        const deivceControlName = json.deivceControlName;

        console.log("deviceId", deviceId)
        console.log("deivceControl", deivceControl)
        console.log("deivceControlName", deivceControlName)
        
        var sql = `UPDATE iot_boiler SET ${deivceControlName}  = ? WHERE id = ?`;
                conn.query(sql, [deivceControl, deviceId], function (err, rows, fields) {
                    if(err) console.log('query is not excuted. select fail...\n' + err);
                    client.publish("iot/status/1000", "ok");
                });
        
      });

  
    }
  
  };