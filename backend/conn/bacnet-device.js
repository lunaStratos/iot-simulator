const bacnet = require('node-bacnet');
const storage = require('../config/storage');

const portNumber = 47808;

// 시뮬레이터 전체를 하나의 BACnet Device 로 노출
const DEVICE_INSTANCE = Number(process.env.BACNET_DEVICE_ID) || 3030;
const DEVICE_NAME = 'Statos Bacnet Test Device';
const VENDOR_ID = 260;
const VENDOR_NAME = 'Lunastratos';
const MODEL_NAME = 'IoT Simulator';
const FIRMWARE_REVISION = '1.0.0';
const MAX_APDU = 1476;

const { ObjectType, PropertyIdentifier: PROP, ApplicationTag: TAG, ErrorClass, ErrorCode,
  ConfirmedServiceChoice, Segmentation, EngineeringUnits, ASN1_ARRAY_ALL,
  ServicesSupported, ObjectTypesSupported } = bacnet.enum;

const OBJECT_TYPE = {
  ANALOG_VALUE: ObjectType.ANALOG_VALUE,
  BINARY_VALUE: ObjectType.BINARY_VALUE,
  DEVICE: ObjectType.DEVICE
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
  },
  3000: {
    temperature: { type: OBJECT_TYPE.ANALOG_VALUE, instance: 20, units: EngineeringUnits.DEGREES_CELSIUS }
  }
};

/** objectId(type, instance) → { deviceId, name, obj } */
function findObject(objectType, objectInstance) {
  for (const [deviceId, objects] of Object.entries(deviceObjectMap)) {
    for (const [name, obj] of Object.entries(objects)) {
      if (obj.type === objectType && obj.instance === objectInstance) {
        return { deviceId, name, obj };
      }
    }
  }
  return null;
}

/** Device 객체의 object-list */
function objectList() {
  const list = [{ type: TAG.OBJECTIDENTIFIER, value: { type: OBJECT_TYPE.DEVICE, instance: DEVICE_INSTANCE } }];
  for (const objects of Object.values(deviceObjectMap)) {
    for (const obj of Object.values(objects)) {
      list.push({ type: TAG.OBJECTIDENTIFIER, value: { type: obj.type, instance: obj.instance } });
    }
  }
  return list;
}

/** 비트 번호 목록 → BACnet BIT STRING */
function bitString(bitsUsed, setBits = []) {
  const value = new Array(Math.ceil(bitsUsed / 8)).fill(0);
  for (const bit of setBits) value[bit >> 3] |= 1 << (bit & 7);
  return [{ type: TAG.BIT_STRING, value: { bitsUsed, value } }];
}

// Device 객체가 지원하는 속성 (ReadPropertyMultiple ALL/REQUIRED 응답용)
const DEVICE_PROPERTIES = [
  PROP.OBJECT_IDENTIFIER, PROP.OBJECT_NAME, PROP.OBJECT_TYPE, PROP.SYSTEM_STATUS,
  PROP.VENDOR_NAME, PROP.VENDOR_IDENTIFIER, PROP.MODEL_NAME, PROP.FIRMWARE_REVISION,
  PROP.APPLICATION_SOFTWARE_VERSION, PROP.PROTOCOL_VERSION, PROP.PROTOCOL_REVISION,
  PROP.PROTOCOL_SERVICES_SUPPORTED, PROP.PROTOCOL_OBJECT_TYPES_SUPPORTED, PROP.OBJECT_LIST,
  PROP.MAX_APDU_LENGTH_ACCEPTED, PROP.SEGMENTATION_SUPPORTED, PROP.APDU_TIMEOUT,
  PROP.NUMBER_OF_APDU_RETRIES, PROP.DEVICE_ADDRESS_BINDING, PROP.DATABASE_REVISION
];

// 포인트 객체(AV/BV)가 지원하는 속성
const OBJECT_PROPERTIES = [
  PROP.OBJECT_IDENTIFIER, PROP.OBJECT_NAME, PROP.OBJECT_TYPE, PROP.PRESENT_VALUE,
  PROP.STATUS_FLAGS, PROP.EVENT_STATE, PROP.OUT_OF_SERVICE
];

/** Device 객체 속성 값 (arrayIndex: object-list 개별 원소 조회, 0 = 개수) */
function readDeviceProperty(propertyId, arrayIndex) {
  if (propertyId === PROP.OBJECT_LIST && arrayIndex !== ASN1_ARRAY_ALL) {
    const list = objectList();
    if (arrayIndex === 0) return [{ type: TAG.UNSIGNED_INTEGER, value: list.length }];
    return list[arrayIndex - 1] ? [list[arrayIndex - 1]] : null;
  }
  switch (propertyId) {
    case PROP.OBJECT_IDENTIFIER: return [{ type: TAG.OBJECTIDENTIFIER, value: { type: OBJECT_TYPE.DEVICE, instance: DEVICE_INSTANCE } }];
    case PROP.OBJECT_NAME:       return [{ type: TAG.CHARACTER_STRING, value: DEVICE_NAME }];
    case PROP.OBJECT_TYPE:       return [{ type: TAG.ENUMERATED, value: OBJECT_TYPE.DEVICE }];
    case PROP.SYSTEM_STATUS:     return [{ type: TAG.ENUMERATED, value: 0 }]; // OPERATIONAL
    case PROP.VENDOR_NAME:       return [{ type: TAG.CHARACTER_STRING, value: VENDOR_NAME }];
    case PROP.VENDOR_IDENTIFIER: return [{ type: TAG.UNSIGNED_INTEGER, value: VENDOR_ID }];
    case PROP.MODEL_NAME:        return [{ type: TAG.CHARACTER_STRING, value: MODEL_NAME }];
    case PROP.FIRMWARE_REVISION:
    case PROP.APPLICATION_SOFTWARE_VERSION:
      return [{ type: TAG.CHARACTER_STRING, value: FIRMWARE_REVISION }];
    case PROP.PROTOCOL_VERSION:  return [{ type: TAG.UNSIGNED_INTEGER, value: 1 }];
    case PROP.PROTOCOL_REVISION: return [{ type: TAG.UNSIGNED_INTEGER, value: 14 }];
    case PROP.PROTOCOL_SERVICES_SUPPORTED:
      return bitString(40, [
        ServicesSupported.READ_PROPERTY, ServicesSupported.READ_PROPERTY_MULTIPLE,
        ServicesSupported.WRITE_PROPERTY, ServicesSupported.I_AM, ServicesSupported.WHO_IS
      ]);
    case PROP.PROTOCOL_OBJECT_TYPES_SUPPORTED:
      return bitString(56, [ObjectTypesSupported.ANALOG_VALUE, ObjectTypesSupported.BINARY_VALUE, ObjectTypesSupported.DEVICE]);
    case PROP.OBJECT_LIST:              return objectList();
    case PROP.MAX_APDU_LENGTH_ACCEPTED: return [{ type: TAG.UNSIGNED_INTEGER, value: MAX_APDU }];
    case PROP.SEGMENTATION_SUPPORTED:   return [{ type: TAG.ENUMERATED, value: Segmentation.NO_SEGMENTATION }];
    case PROP.APDU_TIMEOUT:             return [{ type: TAG.UNSIGNED_INTEGER, value: 3000 }];
    case PROP.NUMBER_OF_APDU_RETRIES:   return [{ type: TAG.UNSIGNED_INTEGER, value: 3 }];
    case PROP.DEVICE_ADDRESS_BINDING:   return [];
    case PROP.DATABASE_REVISION:        return [{ type: TAG.UNSIGNED_INTEGER, value: 1 }];
    default:                            return null;
  }
}

/** 디바이스 포인트 객체 속성 값 */
function readObjectProperty(found, propertyId) {
  const { deviceId, name, obj } = found;
  switch (propertyId) {
    case PROP.OBJECT_IDENTIFIER: return [{ type: TAG.OBJECTIDENTIFIER, value: { type: obj.type, instance: obj.instance } }];
    case PROP.OBJECT_NAME:       return [{ type: TAG.CHARACTER_STRING, value: `${deviceId}_${name}` }];
    case PROP.OBJECT_TYPE:       return [{ type: TAG.ENUMERATED, value: obj.type }];
    case PROP.STATUS_FLAGS:      return bitString(4);                          // 모두 false
    case PROP.EVENT_STATE:       return [{ type: TAG.ENUMERATED, value: 0 }];  // NORMAL
    case PROP.OUT_OF_SERVICE:    return [{ type: TAG.BOOLEAN, value: false }];
    case PROP.UNITS:
      return obj.type === OBJECT_TYPE.ANALOG_VALUE
        ? [{ type: TAG.ENUMERATED, value: obj.units ?? EngineeringUnits.NO_UNITS }]
        : null;
    case PROP.PRESENT_VALUE: {
      const raw = storage.getValue(deviceId, name);
      if (obj.type === OBJECT_TYPE.BINARY_VALUE) {
        return [{ type: TAG.ENUMERATED, value: raw && raw !== '0' ? 1 : 0 }];
      }
      const num = parseFloat(raw);
      return [{ type: TAG.REAL, value: Number.isFinite(num) ? num : 0 }];
    }
    default: return null;
  }
}

/** objectId 가 가리키는 객체 → { read(propertyId, index), properties } | null */
function resolveObject(objectId) {
  if (objectId.type === OBJECT_TYPE.DEVICE && objectId.instance === DEVICE_INSTANCE) {
    return { read: readDeviceProperty, properties: DEVICE_PROPERTIES };
  }
  const found = findObject(objectId.type, objectId.instance);
  if (!found) return null;
  const properties = found.obj.type === OBJECT_TYPE.ANALOG_VALUE
    ? [...OBJECT_PROPERTIES, PROP.UNITS]
    : OBJECT_PROPERTIES;
  return { read: (id) => readObjectProperty(found, id), properties, found };
}

function errorValue(errorClass, errorCode) {
  return [{ type: TAG.ERROR, value: { type: 'BacnetError', errorClass, errorCode } }];
}

module.exports = {

  connect() {
    const server = new bacnet({ port: portNumber });
    console.info('[BACnet] Server started — port=%d deviceInstance=%d', portNumber, DEVICE_INSTANCE);

    server.on('whoIs', (msg) => {
      const { lowLimit, highLimit } = msg.payload || {};
      if (lowLimit !== undefined && highLimit !== undefined &&
          (DEVICE_INSTANCE < lowLimit || DEVICE_INSTANCE > highLimit)) {
        return;
      }
      console.log('[BACnet] WhoIs — from=%s → IAm %d', msg.header.sender.address, DEVICE_INSTANCE);
      server.iAmResponse(null, DEVICE_INSTANCE, Segmentation.NO_SEGMENTATION, VENDOR_ID);
    });

    server.on('readProperty', (msg) => {
      const { objectId, property } = msg.payload;
      const receiver = msg.header.sender;

      const target = resolveObject(objectId);
      if (!target) {
        console.log('[BACnet] ReadProperty — unknown object type=%d instance=%d', objectId.type, objectId.instance);
        server.errorResponse(receiver, ConfirmedServiceChoice.READ_PROPERTY, msg.invokeId, ErrorClass.OBJECT, ErrorCode.UNKNOWN_OBJECT);
        return;
      }
      if (target.found) {
        console.log('[BACnet] ReadProperty — deviceId=%s prop=%s propertyId=%d', target.found.deviceId, target.found.name, property.id);
      }

      const values = target.read(property.id, property.index);
      if (!values) {
        server.errorResponse(receiver, ConfirmedServiceChoice.READ_PROPERTY, msg.invokeId, ErrorClass.PROPERTY, ErrorCode.UNKNOWN_PROPERTY);
        return;
      }
      server.readPropertyResponse(receiver, msg.invokeId, objectId, property, values);
    });

    server.on('readPropertyMultiple', (msg) => {
      const receiver = msg.header.sender;
      const results = msg.payload.properties.map(({ objectId, properties }) => {
        const target = resolveObject(objectId);
        if (!target) {
          return {
            objectId,
            values: properties.map((p) => ({ property: p, value: errorValue(ErrorClass.OBJECT, ErrorCode.UNKNOWN_OBJECT) }))
          };
        }

        // ALL / REQUIRED / OPTIONAL 은 지원 속성 전체로 확장
        const refs = [];
        for (const p of properties) {
          if (p.id === PROP.ALL || p.id === PROP.REQUIRED) {
            target.properties.forEach((id) => refs.push({ id, index: ASN1_ARRAY_ALL }));
          } else if (p.id !== PROP.OPTIONAL) {
            refs.push(p);
          }
        }

        return {
          objectId,
          values: refs.map((p) => ({
            property: p,
            value: target.read(p.id, p.index) || errorValue(ErrorClass.PROPERTY, ErrorCode.UNKNOWN_PROPERTY)
          }))
        };
      });

      console.log('[BACnet] ReadPropertyMultiple — from=%s objects=%d', receiver.address, results.length);
      server.readPropertyMultipleResponse(receiver, msg.invokeId, results);
    });

    server.on('writeProperty', (msg) => {
      // payload = { objectId, value: { property, value: [{ type, value }], priority } }
      const { objectId } = msg.payload;
      const { property, value } = msg.payload.value;
      const receiver = msg.header.sender;

      const found = findObject(objectId.type, objectId.instance);
      if (!found) {
        console.log('[BACnet] WriteProperty — unknown object type=%d instance=%d', objectId.type, objectId.instance);
        server.errorResponse(receiver, ConfirmedServiceChoice.WRITE_PROPERTY, msg.invokeId, ErrorClass.OBJECT, ErrorCode.UNKNOWN_OBJECT);
        return;
      }
      if (property.id !== PROP.PRESENT_VALUE) {
        server.errorResponse(receiver, ConfirmedServiceChoice.WRITE_PROPERTY, msg.invokeId, ErrorClass.PROPERTY, ErrorCode.WRITE_ACCESS_DENIED);
        return;
      }

      const { deviceId, name } = found;
      let writeValue = value && value[0] ? value[0].value : null;
      // REAL(float32) 오차 정리 — 23.7 → 23.700000762939453 방지
      if (typeof writeValue === 'number') writeValue = Number(writeValue.toPrecision(7));
      console.log('[BACnet] WriteProperty — deviceId=%s %s=%s', deviceId, name, writeValue);

      const ok = writeValue !== null && storage.setValue(deviceId, name, writeValue);
      if (!ok) {
        console.error('[BACnet] WriteProperty failed — deviceId=%s %s=%s', deviceId, name, writeValue);
        server.errorResponse(receiver, ConfirmedServiceChoice.WRITE_PROPERTY, msg.invokeId, ErrorClass.PROPERTY, ErrorCode.VALUE_OUT_OF_RANGE);
      } else {
        console.log('[BACnet] WriteProperty OK — deviceId=%s %s=%s', deviceId, name, writeValue);
        server.simpleAckResponse(receiver, ConfirmedServiceChoice.WRITE_PROPERTY, msg.invokeId);
      }
    });
  }

};
