/**
 * 프로토콜별 클라이언트 — 각 프로토콜 서버에 실제로 통신한다.
 * iot.js 라우터에서 호출하여 사용.
 */
const mqtt = require('mqtt');
const coap = require('coap');
const net = require('net');
const opcua = require('node-opcua');
const ModbusRTU = require('modbus-serial');

// ─── MQTT 클라이언트 ────────────────────────────────────
const mqttClient = mqtt.connect('mqtt://localhost', { port: 1883, clientId: 'api-bridge-' + Date.now() });
let mqttReady = false;
mqttClient.on('connect', () => { mqttReady = true; });

function mqttStatus(deviceId) {
  return new Promise((resolve, reject) => {
    if (!mqttReady) return reject(new Error('MQTT not connected'));
    const topic = 'iot/request/' + deviceId;
    const replyTopic = 'iot/response/' + deviceId + '/' + Date.now();

    const timeout = setTimeout(() => {
      mqttClient.unsubscribe(replyTopic);
      reject(new Error('MQTT timeout'));
    }, 5000);

    mqttClient.subscribe(replyTopic, () => {
      mqttClient.publish(topic, JSON.stringify({ action: 'status', replyTopic }));
    });

    mqttClient.on('message', function handler(t, msg) {
      if (t === replyTopic) {
        clearTimeout(timeout);
        mqttClient.removeListener('message', handler);
        mqttClient.unsubscribe(replyTopic);
        resolve(JSON.parse(msg.toString()));
      }
    });
  });
}

function mqttControl(deviceId, controlName, controlValue) {
  return new Promise((resolve, reject) => {
    if (!mqttReady) return reject(new Error('MQTT not connected'));
    mqttClient.publish('iot/control', JSON.stringify({
      deviceId, deviceControl: controlValue, deviceControlName: controlName
    }), (err) => {
      if (err) reject(err);
      else resolve({ status: 'ok' });
    });
  });
}

// ─── CoAP 클라이언트 ────────────────────────────────────
function coapStatus(deviceId) {
  return new Promise((resolve, reject) => {
    const req = coap.request({ hostname: 'localhost', port: 5683, pathname: '/iot/status/' + deviceId, method: 'GET' });
    req.on('response', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function coapControl(deviceId, controlName, controlValue) {
  return new Promise((resolve, reject) => {
    const req = coap.request({ hostname: 'localhost', port: 5683, pathname: '/iot/control/' + deviceId, method: 'PUT' });
    req.on('response', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ deviceControl: controlValue, deviceControlName: controlName }));
    req.end();
  });
}

// ─── BACnet 클라이언트 ──────────────────────────────────
const bacnet = require('node-bacnet');
const bacnetClient = new bacnet();

const BACNET_TARGET = 'localhost';
const bacnetObjectMap = {
  1000: {
    hope_temperature: { type: 2, instance: 1 },
    now_temperature:  { type: 2, instance: 2 },
    humidity:         { type: 2, instance: 3 },
    mode:             { type: 2, instance: 4 },
    'switch':         { type: 5, instance: 1 },
    status:           { type: 2, instance: 5 }
  },
  2000: {
    strength: { type: 2, instance: 10 },
    mode:     { type: 2, instance: 11 },
    'switch': { type: 5, instance: 10 },
    color:    { type: 2, instance: 12 },
    status:   { type: 2, instance: 13 }
  }
};

function bacnetStatus(deviceId) {
  return new Promise((resolve, reject) => {
    const objects = bacnetObjectMap[deviceId];
    if (!objects) return reject(new Error('Unknown BACnet device'));

    const results = {};
    const entries = Object.entries(objects);
    let pending = entries.length;

    entries.forEach(([name, obj]) => {
      bacnetClient.readProperty(BACNET_TARGET, { type: obj.type, instance: obj.instance }, 85, (err, value) => {
        if (!err && value && value.values && value.values[0]) {
          results[name] = String(value.values[0].value);
        }
        pending--;
        if (pending === 0) {
          resolve({ device: { id: Number(deviceId), json: results }, protocol: 'bacnet' });
        }
      });
    });
  });
}

function bacnetControl(deviceId, controlName, controlValue) {
  return new Promise((resolve, reject) => {
    const objects = bacnetObjectMap[deviceId];
    if (!objects || !objects[controlName]) return reject(new Error('Unknown BACnet object'));
    const obj = objects[controlName];
    
    bacnetClient.writeProperty(BACNET_TARGET, { type: obj.type, instance: obj.instance }, 85,
      [{ type: 7, value: String(controlValue) }], (err) => {
        if (err) reject(err);
        else resolve({ status: 'ok' });
      }
    );
  });
}

// ─── OPC-UA 클라이언트 ──────────────────────────────────
let opcuaSession = null;

async function getOpcuaSession() {
  if (opcuaSession) return opcuaSession;

  const client = opcua.OPCUAClient.create({ endpointMustExist: false });
  await client.connect('opc.tcp://localhost:4840/UA/IoTSimulator');
  opcuaSession = await client.createSession();
  return opcuaSession;
}

async function opcuaStatus(deviceId) {
  const session = await getOpcuaSession();
  const propNames = deviceId === '1000' || deviceId === 1000
    ? ['hope_temperature', 'now_temperature', 'humidity', 'mode', 'switch', 'status']
    : ['switch', 'color', 'strength', 'mode', 'status'];

  const results = {};
  for (const name of propNames) {
    const nodeId = `ns=1;s=${deviceId}_${name}`;
    try {
      const dataValue = await session.read({ nodeId, attributeId: opcua.AttributeIds.Value });
      if (dataValue.value && dataValue.value.value !== undefined) {
        results[name] = String(dataValue.value.value);
      }
    } catch (e) {
      console.error('[OPC-UA Client] Read failed — prop=%s error=%s', name, e.message);
    }
  }
  return { device: { id: Number(deviceId), json: results }, protocol: 'opcua' };
}

async function opcuaControl(deviceId, controlName, controlValue) {
  const session = await getOpcuaSession();
  const nodeId = `ns=1;s=${deviceId}_${controlName}`;

  await session.write({
    nodeId,
    attributeId: opcua.AttributeIds.Value,
    value: {
      value: new opcua.Variant({ dataType: opcua.DataType.String, value: String(controlValue) })
    }
  });
  return { status: 'ok' };
}

// ─── Modbus TCP 클라이언트 ──────────────────────────────
const modbusRegisterMap = {
  1000: {
    hope_temperature: 0,
    now_temperature: 1,
    humidity: 2,
    mode: 3,
    'switch': 4
  },
  2000: {
    'switch': 100,
    strength: 101,
    mode: 102
  }
};

function modbusStatus(deviceId) {
  return new Promise((resolve, reject) => {
    const client = new ModbusRTU();
    const regs = modbusRegisterMap[deviceId];
    if (!regs) return reject(new Error('Unknown Modbus device'));

    client.connectTCP('localhost', { port: 5020 }, () => {
      client.setID(1);

      const entries = Object.entries(regs);
      const results = {};
      let pending = entries.length;

      entries.forEach(([name, addr]) => {
        client.readHoldingRegisters(addr, 1, (err, data) => {
          if (!err && data && data.data) {
            results[name] = String(data.data[0]);
          }
          pending--;
          if (pending === 0) {
            client.close(() => {});
            resolve({ device: { id: Number(deviceId), json: results }, protocol: 'modbus' });
          }
        });
      });
    });

    client.on('error', (err) => {
      reject(err);
    });
  });
}

function modbusControl(deviceId, controlName, controlValue) {
  return new Promise((resolve, reject) => {
    const regs = modbusRegisterMap[deviceId];
    if (!regs || regs[controlName] === undefined) return reject(new Error('Unknown Modbus register'));

    const client = new ModbusRTU();
    client.connectTCP('localhost', { port: 5020 }, () => {
      client.setID(1);
      client.writeRegister(regs[controlName], parseInt(controlValue) || 0, (err) => {
        client.close(() => {});
        if (err) reject(err);
        else resolve({ status: 'ok' });
      });
    });

    client.on('error', (err) => {
      reject(err);
    });
  });
}

// ─── 통합 인터페이스 ────────────────────────────────────
module.exports = {
  /**
   * 디바이스 상태 조회
   * @param {string} protocol - http|mqtt|coap|bacnet|opcua|modbus
   * @param {string|number} deviceId
   * @returns {Promise<object>}
   */
  getStatus(protocol, deviceId) {
    switch (protocol) {
      case 'mqtt':   return mqttStatus(deviceId);
      case 'coap':   return coapStatus(deviceId);
      case 'bacnet': return bacnetStatus(deviceId);
      case 'opcua':  return opcuaStatus(deviceId);
      case 'modbus': return modbusStatus(deviceId);
      default:       return Promise.reject(new Error('use-http'));
    }
  },

  /**
   * 디바이스 제어
   * @param {string} protocol
   * @param {string|number} deviceId
   * @param {string} controlName
   * @param {*} controlValue
   * @returns {Promise<object>}
   */
  control(protocol, deviceId, controlName, controlValue) {
    switch (protocol) {
      case 'mqtt':   return mqttControl(deviceId, controlName, controlValue);
      case 'coap':   return coapControl(deviceId, controlName, controlValue);
      case 'bacnet': return bacnetControl(deviceId, controlName, controlValue);
      case 'opcua':  return opcuaControl(deviceId, controlName, controlValue);
      case 'modbus': return modbusControl(deviceId, controlName, controlValue);
      default:       return Promise.reject(new Error('use-http'));
    }
  }
};
