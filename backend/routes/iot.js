const express = require('express');
const router = express.Router();
const storage = require('../config/storage');
const protocolClient = require('../conn/protocol-client');

router.get('/protocols', function(req, res) {
    res.json({
        protocols: [
            { id: 'http', name: 'HTTP (REST)', port: 41234 },
            { id: 'mqtt', name: 'MQTT', port: 1883 },
            { id: 'coap', name: 'CoAP', port: 5683 },
            { id: 'bacnet', name: 'BACnet', port: 47808 },
            { id: 'opcua', name: 'OPC-UA', port: 4840 },
            { id: 'modbus', name: 'Modbus TCP', port: 5020 },
            { id: 'dnp3', name: 'DNP3', port: 20000 },
            { id: 'iec61850', name: 'IEC 61850 (MMS)', port: 10200 }
        ]
    });
});

router.get('/status/:deviceId', function(req, res) {
    const deviceId = req.params.deviceId;
    const protocol = req.query.protocol || 'http';
    console.log('[API] GET status — protocol=%s deviceId=%s', protocol, deviceId);

    if (protocol !== 'http') {
        protocolClient.getStatus(protocol, deviceId)
            .then((data) => {
                data.protocol = protocol;
                console.log('[API] GET status OK — protocol=%s deviceId=%s', protocol, deviceId);
                res.json(data);
            })
            .catch((err) => {
                console.error('[API] GET status FAIL — protocol=%s deviceId=%s error=%s (fallback to storage)', protocol, deviceId, err.message);
                respondDeviceStatus(deviceId, protocol, res);
            });
        return;
    }

    respondDeviceStatus(deviceId, protocol, res);
});

function respondDeviceStatus(deviceId, protocol, res) {
    const device = storage.getDevice(deviceId);
    if (!device) {
        console.log('[API] Device not found — deviceId=%s', deviceId);
        return res.status(404).json({ error: 'device not found' });
    }
    res.json({ device, protocol });
}

router.put('/control/:deviceId', (req, res) => {
    const protocol = req.query.protocol || 'http';
    const deviceId = req.params.deviceId;
    const deviceControl = req.body.deviceControl;
    const deviceControlName = req.body.deviceControlName;

    console.log('[API] PUT control — protocol=%s deviceId=%s %s=%s', protocol, deviceId, deviceControlName, deviceControl);

    if (protocol !== 'http') {
        protocolClient.control(protocol, deviceId, deviceControlName, deviceControl)
            .then((data) => {
                data.protocol = protocol;
                console.log('[API] PUT control OK — protocol=%s deviceId=%s', protocol, deviceId);
                res.json(data);
            })
            .catch((err) => {
                console.error('[API] PUT control FAIL — protocol=%s deviceId=%s error=%s (fallback to storage)', protocol, deviceId, err.message);
                updateAndRespond(deviceId, deviceControlName, deviceControl, protocol, res);
            });
        return;
    }

    updateAndRespond(deviceId, deviceControlName, deviceControl, protocol, res);
});

function updateAndRespond(deviceId, controlName, controlValue, protocol, res) {
    const ok = storage.setValue(deviceId, controlName, controlValue);
    if (!ok) {
        console.error('[API] Update failed — deviceId=%s %s=%s', deviceId, controlName, controlValue);
        res.json({ status: 'error', protocol });
    } else {
        res.json({ status: 'ok', protocol });
    }
}

module.exports = router;
