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
// 47808 은 BACnet 서버(bacnet-device.js)가 사용 — 같은 포트에 바인딩하면
// 외부 요청이 이 클라이언트 소켓으로 전달되어 REJECT 응답이 나가므로 별도 포트 사용
const BACNET_CLIENT_PORT = Number(process.env.BACNET_CLIENT_PORT) || 47809;
const bacnetClient = new bacnet({ port: BACNET_CLIENT_PORT, reuseAddr: false });
bacnetClient.on('error', (err) => console.error('[BACnet Client] error — %s', err.message));

// node-bacnet 서버는 127.0.0.1 발신 요청을 무시하므로 로컬 비루프백 IPv4 로 요청
function localBacnetTarget() {
  for (const addrs of Object.values(require('os').networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) return a.address + ':47808';
    }
  }
  return '127.0.0.1:47808';
}
const BACNET_TARGET = { address: localBacnetTarget() };
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
  },
  3000: {
    temperature: { type: 2, instance: 20 }
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

const opcuaPropMap = {
  1000: ['hope_temperature', 'now_temperature', 'humidity', 'mode', 'switch', 'status'],
  2000: ['switch', 'color', 'strength', 'mode', 'status'],
  3000: ['temperature', 'status']
};

async function getOpcuaSession() {
  if (opcuaSession) return opcuaSession;

  const client = opcua.OPCUAClient.create({ endpointMustExist: false });
  await client.connect('opc.tcp://localhost:4840/UA/IoTSimulator');
  opcuaSession = await client.createSession();
  return opcuaSession;
}

async function opcuaStatus(deviceId) {
  const session = await getOpcuaSession();
  const propNames = opcuaPropMap[deviceId];
  if (!propNames) throw new Error('Unknown OPC-UA device');

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
// 레지스터 값 = 실제 값 × scale (소수점 값은 정수로 스케일링, 음수는 int16)
const modbusScale = { 3000: { temperature: 10 } };

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
  },
  3000: {
    temperature: 200
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
          if (!err && data && data.buffer) {
            const scale = (modbusScale[deviceId] || {})[name];
            results[name] = scale
              ? String(data.buffer.readInt16BE(0) / scale)
              : String(data.data[0]);
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
      const scale = (modbusScale[deviceId] || {})[controlName];
      const regValue = scale
        ? Math.round(parseFloat(controlValue) * scale) & 0xFFFF
        : parseInt(controlValue) || 0;
      client.writeRegister(regs[controlName], regValue, (err) => {
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

// ─── HomeKit (HAP) 클라이언트 ──────────────────────────
// homekit-device.js 가 insecure 모드로 공개 — 페어링 없이 HAP HTTP 로 접근
const http = require('http');
const hapUuid = require('hap-nodejs').uuid;
const homekitHandler = require('./homekit-device');
const { hexToHs, hsToHex } = require('../util/color');

function hapRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: 'localhost',
      port: homekitHandler.portNumber,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/hap+json',
        Authorization: homekitHandler.PINCODE,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      },
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 204) return resolve(null);
        let json;
        try { json = data ? JSON.parse(data) : null; }
        catch (e) { return reject(e); }
        // 207 Multi-Status — 개별 Characteristic 오류
        const failed = json && json.characteristics && json.characteristics.find((c) => c.status);
        if (res.statusCode >= 400 || failed) {
          return reject(new Error('HAP error — http=' + res.statusCode + ' status=' + (failed ? failed.status : json && json.status)));
        }
        resolve(json);
      });
    });
    req.on('timeout', () => req.destroy(new Error('HomeKit timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// deviceId → [{ aid, iid, def }]  (/accessories 에서 SerialNumber 로 매칭, 1회 캐시)
let hapIndex = null;
const HAP_SERIAL_TYPE = hapUuid.toShortForm(require('hap-nodejs').Characteristic.SerialNumber.UUID);

async function getHapIndex() {
  if (hapIndex) return hapIndex;
  const { accessories } = await hapRequest('GET', '/accessories');
  const index = {};

  homekitHandler.deviceDefs.forEach(({ deviceId, chars }) => {
    const serial = homekitHandler.SERIAL_PREFIX + deviceId;
    const acc = accessories.find((a) => a.services.some((s) =>
      s.characteristics.some((c) => c.type === HAP_SERIAL_TYPE && c.value === serial)));
    if (!acc) return;

    const all = acc.services.flatMap((s) => s.characteristics);
    index[deviceId] = chars.filter((def) => !def.mirror).map((def) => {
      const type = hapUuid.toShortForm(def.type.UUID);
      const c = all.find((x) => x.type === type);
      return c ? { aid: acc.aid, iid: c.iid, def } : null;
    }).filter(Boolean);
  });

  hapIndex = index;
  return hapIndex;
}

async function homekitStatus(deviceId) {
  const entries = (await getHapIndex())[Number(deviceId)];
  if (!entries) throw new Error('Unknown HomeKit device');

  const ids = entries.map((e) => e.aid + '.' + e.iid).join(',');
  let result;
  try {
    result = await hapRequest('GET', '/characteristics?id=' + ids);
  } catch (e) {
    hapIndex = null; // 액세서리 구성이 바뀌었을 수 있으므로 다음 요청에서 재조회
    throw e;
  }

  const results = {};
  const color = {};
  result.characteristics.forEach(({ aid, iid, value }) => {
    const { def } = entries.find((e) => e.aid === aid && e.iid === iid);
    if (def.part) color[def.part] = value;
    else results[def.prop] = def.fromHap ? def.fromHap(value) : String(value);
  });
  if (color.hue !== undefined) results.color = hsToHex(color.hue, color.saturation);

  return { device: { id: Number(deviceId), json: results }, protocol: 'homekit' };
}

async function homekitControl(deviceId, controlName, controlValue) {
  const entries = ((await getHapIndex())[Number(deviceId)] || []).filter((e) => e.def.prop === controlName);
  if (entries.length === 0) throw new Error('Unknown HomeKit characteristic');
  if (entries.some((e) => !e.def.fromHap)) throw new Error('HomeKit characteristic is read-only');

  const hs = controlName === 'color' ? hexToHs(controlValue) : null;
  const characteristics = entries.map(({ aid, iid, def }) => ({
    aid, iid, value: hs ? hs[def.part] : def.toHap(String(controlValue))
  }));

  await hapRequest('PUT', '/characteristics', { characteristics });
  return { status: 'ok' };
}

// ─── Matter 클라이언트 ─────────────────────────────────
// 커미셔닝 없이는 외부 접근이 불가하므로 Matter 엔드포인트 데이터 모델에 직접 접근
const matterHandler = require('./matter-device');

// ─── 통합 인터페이스 ────────────────────────────────────
module.exports = {
  /**
   * 디바이스 상태 조회
   * @param {string} protocol - http|mqtt|coap|bacnet|opcua|modbus|dnp3|iec61850|homekit|matter
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
      case 'homekit':  return homekitStatus(deviceId);
      case 'matter':   return matterHandler.readStatus(deviceId);
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
      case 'homekit':  return homekitControl(deviceId, controlName, controlValue);
      case 'matter':   return matterHandler.writeControl(deviceId, controlName, controlValue);
      default:         return Promise.reject(new Error('use-http'));
    }
  }
};
