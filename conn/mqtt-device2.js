const mqtt = require('mqtt');

module.exports = {
    constructor() {
      this.mqttClient = null;
      this.host = 'mqtt://localhost';
      this.username = ''; // mqtt credentials if these are needed to connect
      this.password = '';
    }
    
    connect() {
      // Connect mqtt with credentials (in case of needed, otherwise we can omit 2nd param)
      this.mqttClient = mqtt.connect(this.host);
  
      // Mqtt error calback
      this.mqttClient.on('error', (err) => {
        console.log(err);
        this.mqttClient.end();
      });
  
      // Connection callback
      this.mqttClient.on('connect', () => {
        console.log(`mqtt client connected`);
      });
  
      // mqtt subscriptions
      this.mqttClient.subscribe('mytopic', {qos: 0});
  
      // When a message arrives, console.log it
      this.mqttClient.on('message', function (topic, message) {
        console.log(message.toString());
      });
  
      this.mqttClient.on('close', () => {
        console.log(`mqtt client disconnected`);
      });
    }
  
    // Sends a mqtt message to topic: mytopic
    sendMessage(message) {
      this.mqttClient.publish('mytopic', message);
    }
  };