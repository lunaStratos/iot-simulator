const net = require('net');
const storage = require('../config/storage');

const portNumber = 10200;

// IEC 61850 데이터 모델 매핑
const pathMap = {
  'Boiler/TTMP1.TmpSp.setMag':    { deviceId: 1000, name: 'hope_temperature' },
  'Boiler/TTMP1.TmpPV.instMag':   { deviceId: 1000, name: 'now_temperature' },
  'Boiler/MMET1.Hum.instMag':     { deviceId: 1000, name: 'humidity' },
  'Boiler/CSWI1.OpMode.stVal':    { deviceId: 1000, name: 'mode' },
  'Boiler/CSWI1.Pos.stVal':       { deviceId: 1000, name: 'switch' },
  'Boiler/GGIO1.Status.stVal':    { deviceId: 1000, name: 'status' },
  'SmartLED/DGEN1.OpMode.stVal':  { deviceId: 2000, name: 'mode' },
  'SmartLED/CSWI1.Pos.stVal':     { deviceId: 2000, name: 'switch' },
  'SmartLED/MMXU1.Brt.instMag':   { deviceId: 2000, name: 'strength' },
  'SmartLED/MMXU1.Col.instMag':   { deviceId: 2000, name: 'color' },
  'SmartLED/GGIO1.Status.stVal':  { deviceId: 2000, name: 'status' }
};

// 디바이스별 경로 그룹
const devicePaths = {
  'Boiler': Object.keys(pathMap).filter(p => p.startsWith('Boiler/')),
  'SmartLED': Object.keys(pathMap).filter(p => p.startsWith('SmartLED/'))
};

const HEADER = Buffer.from([0x4D, 0x4D, 0x53, 0x00]); // "MMS\0"

function buildResponse(serviceType, payload) {
  const jsonBuf = Buffer.from(JSON.stringify(payload), 'utf8');
  const resp = Buffer.alloc(4 + 4 + 1 + jsonBuf.length);
  HEADER.copy(resp, 0);
  resp.writeUInt32BE(1 + jsonBuf.length, 4); // payload length
  resp[8] = serviceType;
  jsonBuf.copy(resp, 9);
  return resp;
}

module.exports = {

  connect() {
    const serverTCP = net.createServer((socket) => {
      console.log('[IEC61850] Client connected — %s:%s', socket.remoteAddress, socket.remotePort);

      let buffer = Buffer.alloc(0);

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        while (buffer.length >= 9) {
          // 헤더 검증: "MMS\0"
          if (buffer[0] !== 0x4D || buffer[1] !== 0x4D || buffer[2] !== 0x53 || buffer[3] !== 0x00) {
            buffer = buffer.slice(1);
            continue;
          }

          const payloadLen = buffer.readUInt32BE(4);
          const totalLength = 8 + payloadLen; // header(4) + length(4) + payload

          if (buffer.length < totalLength) break;

          const serviceType = buffer[8];
          const jsonStr = buffer.slice(9, totalLength).toString('utf8');

          let req;
          try {
            req = JSON.parse(jsonStr);
          } catch (e) {
            console.error('[IEC61850] Invalid JSON — %s', e.message);
            buffer = buffer.slice(totalLength);
            continue;
          }

          if (serviceType === 0x01) {
            // Read 요청
            if (req.path) {
              // 단일 경로 읽기
              const mapping = pathMap[req.path];
              if (mapping) {
                const val = storage.getValue(mapping.deviceId, mapping.name);
                console.log('[IEC61850] Read — %s = %s', req.path, val);
                socket.write(buildResponse(0x81, { path: req.path, value: String(val != null ? val : '') }));
              } else {
                console.log('[IEC61850] Read — unknown path: %s', req.path);
                socket.write(buildResponse(0x81, { error: 'unknown path', path: req.path }));
              }
            } else if (req.device) {
              // 디바이스 전체 읽기
              const paths = devicePaths[req.device];
              if (paths) {
                const values = {};
                for (const p of paths) {
                  const mapping = pathMap[p];
                  const val = storage.getValue(mapping.deviceId, mapping.name);
                  values[mapping.name] = String(val != null ? val : '');
                }
                const deviceId = paths.length > 0 ? pathMap[paths[0]].deviceId : 0;
                console.log('[IEC61850] Read device — %s (%d props)', req.device, paths.length);
                socket.write(buildResponse(0x81, {
                  device: { id: deviceId, json: values },
                  protocol: 'iec61850'
                }));
              } else {
                console.log('[IEC61850] Read — unknown device: %s', req.device);
                socket.write(buildResponse(0x81, { error: 'unknown device', device: req.device }));
              }
            }

          } else if (serviceType === 0x02) {
            // Write 요청
            const mapping = pathMap[req.path];
            if (mapping) {
              console.log('[IEC61850] Write — %s = %s', req.path, req.value);
              storage.setValue(mapping.deviceId, mapping.name, req.value);
              socket.write(buildResponse(0x82, { status: 'ok', path: req.path }));
            } else {
              console.log('[IEC61850] Write — unknown path: %s', req.path);
              socket.write(buildResponse(0x82, { error: 'unknown path', path: req.path }));
            }

          } else if (serviceType === 0x03) {
            // GetNameList
            console.log('[IEC61850] GetNameList');
            socket.write(buildResponse(0x83, {
              paths: Object.keys(pathMap),
              devices: Object.keys(devicePaths)
            }));

          } else {
            console.log('[IEC61850] Unknown service type=0x%s', serviceType.toString(16));
            socket.write(buildResponse(0x80, { error: 'unsupported service' }));
          }

          buffer = buffer.slice(totalLength);
        }
      });

      socket.on('error', (err) => {
        console.error('[IEC61850] Socket error — %s', err.message);
      });
    });

    serverTCP.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error('[IEC61850] Port %d already in use — skipping', portNumber);
      } else {
        console.error('[IEC61850] Server error — %s', err.message);
      }
    });

    serverTCP.listen(portNumber, () => {
      console.info('[IEC61850] Server started — port=%d', portNumber);
    });
  }

};
