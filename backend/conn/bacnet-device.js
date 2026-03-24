const bacnet = require('node-bacnet');
const storage = require('../config/storage');

const portNumber = 47808;

const OBJECT_TYPE = {
  ANALOG_VALUE: 2,
  BINARY_VALUE: 5,
  DEVICE: 8
};

const deviceObjectMap = {
  1000: {
    hope_temperature: { type: OBJECT_TYPE.ANALOG_VALUE, instance: 1 },
    now_temperature:  { type: OBJECT_TYPE.ANALOG_VALUE, instance: 2 },
    humidity:         { type: OBJECT_TYPE.ANALOG_VALUE, instance: 3 },
    mode:             { type: OBJECT_TYPE.ANALOG_VALUE, instance: 4 },
    'switch':         { type: OBJECT_TYPE.BINARY_VALUE, instance: 1 }
  },
  2000: {
    strength: { type: OBJECT_TYPE.ANALOG_VALUE, instance: 10 },
    mode:     { type: OBJECT_TYPE.ANALOG_VALUE, instance: 11 },
    'switch': { type: OBJECT_TYPE.BINARY_VALUE, instance: 10 }
  }
};

module.exports = {

  connect() {
    const server = new bacnet({ port: portNumber });
    console.info('[BACnet] Server started — port=%d', portNumber);

    server.on('whoIs', (msg) => {
      console.log('[BACnet] WhoIs — from=%s', msg.header.sender);
    });

    server.on('readProperty', (msg) => {
      const objectType = msg.payload.objectId.type;
      const objectInstance = msg.payload.objectId.instance;
      const propertyId = msg.payload.property.id;

      let deviceId = null;
      let valueName = null;

      for (const [devId, objects] of Object.entries(deviceObjectMap)) {
        for (const [name, obj] of Object.entries(objects)) {
          if (obj.type === objectType && obj.instance === objectInstance) {
            deviceId = devId;
            valueName = name;
            break;
          }
        }
        if (deviceId) break;
      }

      if (!deviceId) {
        console.log('[BACnet] ReadProperty — unknown object type=%d instance=%d', objectType, objectInstance);
        return;
      }

      console.log('[BACnet] ReadProperty — deviceId=%s prop=%s propertyId=%d', deviceId, valueName, propertyId);

      const val = storage.getValue(deviceId, valueName);
      if (val !== null) {
        console.log('[BACnet] ReadProperty OK — %s=%s', valueName, val);
      }
    });

    server.on('writeProperty', (msg) => {
      const objectType = msg.payload.objectId.type;
      const objectInstance = msg.payload.objectId.instance;
      const value = msg.payload.value;

      let deviceId = null;
      let valueName = null;

      for (const [devId, objects] of Object.entries(deviceObjectMap)) {
        for (const [name, obj] of Object.entries(objects)) {
          if (obj.type === objectType && obj.instance === objectInstance) {
            deviceId = devId;
            valueName = name;
            break;
          }
        }
        if (deviceId) break;
      }

      if (!deviceId) {
        console.log('[BACnet] WriteProperty — unknown object type=%d instance=%d', objectType, objectInstance);
        return;
      }

      const writeValue = value && value[0] ? value[0].value : null;
      console.log('[BACnet] WriteProperty — deviceId=%s %s=%s', deviceId, valueName, writeValue);

      const ok = storage.setValue(deviceId, valueName, writeValue);
      if (!ok) {
        console.error('[BACnet] WriteProperty failed — deviceId=%s %s=%s', deviceId, valueName, writeValue);
      } else {
        console.log('[BACnet] WriteProperty OK — deviceId=%s %s=%s', deviceId, valueName, writeValue);
      }
    });
  }

};
