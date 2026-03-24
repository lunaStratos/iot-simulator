var coap = require('coap');
const storage = require('../config/storage');

module.exports = {

  connect() {
    var portNumber = 5683;
    const server = coap.createServer();

    server.on('request', (req, res) => {
        const deviceId = req.url.substring(req.url.lastIndexOf('/') + 1);
        console.log('[CoAP] Request — method=%s url=%s deviceId=%s', req.method, req.url, deviceId);

        switch(req.url) {
            case "/iot/status/" + deviceId:
              displayOutput(res, req, {'deviceId': deviceId});
            break;
            case "/iot/control/" + deviceId:
              controlProcess(res, req, deviceId);
            break;
            default:
              res.end(JSON.stringify({ error: 'unknown route' }));
        }
    });

    server.listen(() => {
        console.info('[CoAP] Server started — port=%d', portNumber);
    });

    function displayOutput(res, req, content) {
      const device = storage.getDevice(content.deviceId);
      if (!device) {
        res.setOption('Content-Format', 'application/json');
        res.end(JSON.stringify({ error: 'device not found' }));
        return;
      }
      res.setOption('Content-Format', 'application/json');
      res.end(JSON.stringify({ device }));
    }

    function controlProcess(res, req, deviceId) {
      const payloadJson = JSON.parse(req.payload);
      console.log('[CoAP] Control — deviceId=%s %s=%s', deviceId, payloadJson.deviceControlName, payloadJson.deviceControl);

      res.setOption('Content-Format', 'application/json');

      const ok = storage.setValue(deviceId, payloadJson.deviceControlName, payloadJson.deviceControl);
      if (!ok) {
        console.error('[CoAP] Control update failed — deviceId=%s', deviceId);
        res.end(JSON.stringify({ status: "error" }));
      } else {
        res.end(JSON.stringify({ status: "ok" }));
      }
    }

  }

};
