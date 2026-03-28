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

// ─── DNP3 클라이언트 ───────────────────────────────────
const dnp3AnalogInputMap = {
  1000: {
    hope_temperature: 0,
    now_temperature: 1,
    humidity: 2,
    mode: 3
  },
  2000: {
    strength: 10,
    mode: 11
  }
};

const dnp3BinaryInputMap = {
  1000: { 'switch': 0 },
  2000: { 'switch': 10 }
};

function dnp3ReadPoints(host, port, objGroup, startIndex, count) {
  return new Promise((resolve, reject) => {
    const conn = net.createConnection({ host, port }, () => {
      const payloadLen = 7 + (count > 1 ? 2 : 0);
      const frame = Buffer.alloc(4 + payloadLen);
      frame[0] = 0x05;
      frame[1] = 0x64;
      frame.writeUInt16BE(payloadLen, 2);
      frame.writeUInt16LE(1, 4);   // src
      frame.writeUInt16LE(10, 6);  // dst (outstation)
      frame[8] = 0x01;             // Read
      frame[9] = objGroup;
      frame[10] = 1;               // variation
      frame.writeUInt16BE(startIndex, 11);
      if (count > 1) frame.writeUInt16BE(count, 13);
      conn.write(frame);
    });

    const timeout = setTimeout(() => { conn.destroy(); reject(new Error('DNP3 timeout')); }, 5000);

    let buf = Buffer.alloc(0);
    conn.on('data', (data) => {
      buf = Buffer.concat([buf, data]);
      if (buf.length >= 11) {
        clearTimeout(timeout);
        const respCount = buf[10];
        const values = [];
        for (let i = 0; i < respCount && (11 + i * 4 + 4) <= buf.length; i++) {
          values.push(buf.readInt32BE(11 + i * 4));
        }
        conn.destroy();
        resolve(values);
      }
    });

    conn.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

function dnp3Status(deviceId) {
  return new Promise(async (resolve, reject) => {
    try {
      const results = {};
      const aiMap = dnp3AnalogInputMap[deviceId];
      const biMap = dnp3BinaryInputMap[deviceId];

      if (aiMap) {
        const entries = Object.entries(aiMap);
        for (const [name, idx] of entries) {
          const vals = await dnp3ReadPoints('localhost', 20000, 30, idx, 1);
          results[name] = String(vals[0] || 0);
        }
      }

      if (biMap) {
        const entries = Object.entries(biMap);
        for (const [name, idx] of entries) {
          const vals = await dnp3ReadPoints('localhost', 20000, 1, idx, 1);
          results[name] = String(vals[0] || 0);
        }
      }

      resolve({ device: { id: Number(deviceId), json: results }, protocol: 'dnp3' });
    } catch (err) {
      reject(err);
    }
  });
}

function dnp3Control(deviceId, controlName, controlValue) {
  return new Promise((resolve, reject) => {
    // 출력 타입 결정
    let objGroup, index;
    const biMap = dnp3BinaryInputMap[deviceId];
    if (biMap && biMap[controlName] !== undefined) {
      objGroup = 12; // Binary Output
      index = biMap[controlName];
    } else {
      objGroup = 41; // Analog Output
      const aiMap = dnp3AnalogInputMap[deviceId];
      if (aiMap && aiMap[controlName] !== undefined) {
        index = aiMap[controlName];
      } else {
        return reject(new Error('Unknown DNP3 point'));
      }
    }

    const conn = net.createConnection({ host: 'localhost', port: 20000 }, () => {
      const frame = Buffer.alloc(4 + 11);
      frame[0] = 0x05;
      frame[1] = 0x64;
      frame.writeUInt16BE(11, 2);
      frame.writeUInt16LE(1, 4);
      frame.writeUInt16LE(10, 6);
      frame[8] = 0x03;             // Direct Operate
      frame[9] = objGroup;
      frame[10] = 1;
      frame.writeUInt16BE(index, 11);
      frame.writeInt32BE(parseInt(controlValue) || 0, 13);
      conn.write(frame);
    });

    const timeout = setTimeout(() => { conn.destroy(); reject(new Error('DNP3 timeout')); }, 5000);

    conn.on('data', () => {
      clearTimeout(timeout);
      conn.destroy();
      resolve({ status: 'ok' });
    });

    conn.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

// ─── IEC 61850 클라이언트 ──────────────────────────────
const deviceNameMap = { 1000: 'Boiler', 2000: 'SmartLED' };

const iec61850ControlPaths = {
  1000: {
    hope_temperature: 'Boiler/TTMP1.TmpSp.setMag',
    mode: 'Boiler/CSWI1.OpMode.stVal',
    'switch': 'Boiler/CSWI1.Pos.stVal'
  },
  2000: {
    mode: 'SmartLED/DGEN1.OpMode.stVal',
    'switch': 'SmartLED/CSWI1.Pos.stVal',
    strength: 'SmartLED/MMXU1.Brt.instMag',
    color: 'SmartLED/MMXU1.Col.instMag'
  }
};

function iec61850Send(serviceType, payload) {
  return new Promise((resolve, reject) => {
    const conn = net.createConnection({ host: 'localhost', port: 10200 }, () => {
      const jsonBuf = Buffer.from(JSON.stringify(payload), 'utf8');
      const frame = Buffer.alloc(4 + 4 + 1 + jsonBuf.length);
      frame[0] = 0x4D; frame[1] = 0x4D; frame[2] = 0x53; frame[3] = 0x00;
      frame.writeUInt32BE(1 + jsonBuf.length, 4);
      frame[8] = serviceType;
      jsonBuf.copy(frame, 9);
      conn.write(frame);
    });

    const timeout = setTimeout(() => { conn.destroy(); reject(new Error('IEC61850 timeout')); }, 5000);

    let buf = Buffer.alloc(0);
    conn.on('data', (data) => {
      buf = Buffer.concat([buf, data]);
      if (buf.length >= 9) {
        const pLen = buf.readUInt32BE(4);
        if (buf.length >= 8 + pLen) {
          clearTimeout(timeout);
          const jsonStr = buf.slice(9, 8 + pLen).toString('utf8');
          conn.destroy();
          try { resolve(JSON.parse(jsonStr)); }
          catch (e) { reject(e); }
        }
      }
    });

    conn.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

function iec61850Status(deviceId) {
  const deviceName = deviceNameMap[deviceId] || deviceNameMap[Number(deviceId)];
  if (!deviceName) return Promise.reject(new Error('Unknown IEC61850 device'));
  return iec61850Send(0x01, { device: deviceName });
}

function iec61850Control(deviceId, controlName, controlValue) {
  const paths = iec61850ControlPaths[deviceId] || iec61850ControlPaths[Number(deviceId)];
  if (!paths || !paths[controlName]) return Promise.reject(new Error('Unknown IEC61850 path'));
  return iec61850Send(0x02, { path: paths[controlName], value: String(controlValue) });
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
      case 'modbus':   return modbusStatus(deviceId);
      case 'dnp3':     return dnp3Status(deviceId);
      case 'iec61850': return iec61850Status(deviceId);
      default:         return Promise.reject(new Error('use-http'));
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
      case 'modbus':   return modbusControl(deviceId, controlName, controlValue);
      case 'dnp3':     return dnp3Control(deviceId, controlName, controlValue);
      case 'iec61850': return iec61850Control(deviceId, controlName, controlValue);
      default:         return Promise.reject(new Error('use-http'));
    }
  }
};
