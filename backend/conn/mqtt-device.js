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
              const adr = "1000"
              var sql = `select * , (select concat('{' ,group_concat('"',name,'"',':' ,'"',val,'"' ),'}') from iot_device_value where id = ${adr}) as json from iot_device where id = ${adr}`
    
                conn.query(sql, [], function (err, rows, fields) {
                    if(err) console.log('query is not excuted. select fail...\n' + err);
                    else{
                        rows[0].json = JSON.parse(rows[0].json)
                        client.publish("iot/status/1000", "" + JSON.stringify(rows[0]));                        
                    }
                });
            }, 3000);
        });

      });

      /**
       {"deviceId" : "1000", "deviceControl" : "0","deviceControlName":  "switch"}
       */
      // display all incoming messages
      client.on("message", function (topic, message) {
        console.log('Received operation "' + message + '"');

        const json = JSON.parse(message);
        const deviceId = json.deviceId;
        const deviceControl = json.deviceControl;
        const deviceControlName = json.deviceControlName;

        console.log("deviceId", deviceId)
        console.log("deviceControl", deviceControl)
        console.log("deviceControlName", deviceControlName)
        
        var sql = 'UPDATE iot_device_value SET val = ? WHERE name = ? AND id = ?';
        conn.query(sql, [deviceControl, deviceControlName , deviceId], function (err, rows, fields) {
          if(err) {
              console.log('query is not excuted. select fail...\n' + err);
              client.publish("iot/status/" + deviceId, "error");
          }else {
              client.publish("iot/status/" + deviceId, JSON.stringify({status: "ok"}));
          }

        });
        
      });






      // once connected...
      client.on("connect", function () {
        // ...register a new device with restart operation
        client.publish("iot/status/2000", "100," + device_name + ",c8y_MQTTDevice", function() {
            // listen for operations
            client.subscribe("iot/control");

            // send a temperature measurement every 3 seconds
            setInterval(function() {
              const adr = "2000"
              var sql = `select * , (select concat('{' ,group_concat('"',name,'"',':' ,'"',val,'"' ),'}') from iot_device_value where id = ${adr}) as json from iot_device where id = ${adr}`
    
                conn.query(sql, [], function (err, rows, fields) {
                    if(err) console.log('query is not excuted. select fail...\n' + err);
                    else{
                        rows[0].json = JSON.parse(rows[0].json)
                        client.publish("iot/status/2000", "" + JSON.stringify(rows[0].json));                        
                    }
                });
            }, 3000);
        });

      });


  
    }
  
  };
  