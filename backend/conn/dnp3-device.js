const net = require('net');
const storage = require('../config/storage');

const portNumber = 20000;

// DNP3 포인트 매핑
const analogInputMap = {
  0:  { deviceId: 1000, name: 'hope_temperature' },
  1:  { deviceId: 1000, name: 'now_temperature' },
  2:  { deviceId: 1000, name: 'humidity' },
  3:  { deviceId: 1000, name: 'mode' },
  10: { deviceId: 2000, name: 'strength' },
  11: { deviceId: 2000, name: 'mode' }
};

const binaryInputMap = {
  0:  { deviceId: 1000, name: 'switch' },
  10: { deviceId: 2000, name: 'switch' }
};

const analogOutputMap = {
  0:  { deviceId: 1000, name: 'hope_temperature' },
  3:  { deviceId: 1000, name: 'mode' },
  10: { deviceId: 2000, name: 'strength' },
  11: { deviceId: 2000, name: 'mode' }
};

const binaryOutputMap = {
  0:  { deviceId: 1000, name: 'switch' },
  10: { deviceId: 2000, name: 'switch' }
};

// Object Group 상수
const OBJ_BINARY_INPUT  = 1;
const OBJ_ANALOG_INPUT  = 30;
const OBJ_BINARY_OUTPUT = 12;
const OBJ_ANALOG_OUTPUT = 41;

function getPointMap(objGroup) {
  switch (objGroup) {
    case OBJ_ANALOG_INPUT:  return analogInputMap;
    case OBJ_BINARY_INPUT:  return binaryInputMap;
    case OBJ_ANALOG_OUTPUT: return analogOutputMap;
    case OBJ_BINARY_OUTPUT: return binaryOutputMap;
    default: return null;
  }
}

module.exports = {

  connect() {
    const serverTCP = net.createServer((socket) => {
      console.log('[DNP3] Client connected — %s:%s', socket.remoteAddress, socket.remotePort);

      let buffer = Buffer.alloc(0);

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        while (buffer.length >= 12) {
          // 헤더 검증: 0x05 0x64
          if (buffer[0] !== 0x05 || buffer[1] !== 0x64) {
            buffer = buffer.slice(1);
            continue;
          }

          const frameLength = buffer.readUInt16BE(2);
          const totalLength = 4 + frameLength; // 헤더(2) + 길이(2) + 페이로드

          if (buffer.length < totalLength) break;

          const srcAddr = buffer.readUInt16LE(4);
          const dstAddr = buffer.readUInt16LE(6);
          const fc = buffer[8];
          const objGroup = buffer[9];
          const variation = buffer[10];
          const startIndex = buffer.readUInt16BE(11);
          const count = (totalLength > 13) ? buffer.readUInt16BE(13) : 1;

          if (fc === 0x01) {
            // Read 요청
            const pointMap = getPointMap(objGroup);
            if (!pointMap) {
              console.log('[DNP3] Read — unknown object group=%d', objGroup);
              sendErrorResponse(socket, srcAddr, dstAddr, fc);
              buffer = buffer.slice(totalLength);
              continue;
            }

            console.log('[DNP3] Read — group=%d start=%d count=%d', objGroup, startIndex, count);

            const values = [];
            for (let i = 0; i < count; i++) {
              const idx = startIndex + i;
              const mapping = pointMap[idx];
              if (mapping) {
                const val = parseInt(storage.getValue(mapping.deviceId, mapping.name)) || 0;
                values.push(val);
              } else {
                values.push(0);
              }
            }

            // 응답 프레임 구성
            const dataLen = count * 4; // 각 값 4바이트 (Int32)
            const respPayloadLen = 7 + dataLen; // src(2)+dst(2)+fc(1)+group(1)+count(1)+data
            const resp = Buffer.alloc(4 + respPayloadLen);
            resp[0] = 0x05;
            resp[1] = 0x64;
            resp.writeUInt16BE(respPayloadLen, 2);
            resp.writeUInt16LE(dstAddr, 4);
            resp.writeUInt16LE(srcAddr, 6);
            resp[8] = 0x81; // Read response
            resp[9] = objGroup;
            resp[10] = count;

            for (let i = 0; i < count; i++) {
              resp.writeInt32BE(values[i], 11 + i * 4);
            }

            socket.write(resp);

          } else if (fc === 0x03) {
            // Direct Operate (Write)
            const pointMap = getPointMap(objGroup);
            if (!pointMap) {
              console.log('[DNP3] Write — unknown object group=%d', objGroup);
              sendErrorResponse(socket, srcAddr, dstAddr, fc);
              buffer = buffer.slice(totalLength);
              continue;
            }

            const value = buffer.readInt32BE(13);
            const mapping = pointMap[startIndex];

            if (mapping) {
              console.log('[DNP3] DirectOperate — group=%d index=%d %s=%d', objGroup, startIndex, mapping.name, value);
              storage.setValue(mapping.deviceId, mapping.name, value);
            } else {
              console.log('[DNP3] DirectOperate — group=%d index=%d (unmapped)', objGroup, startIndex);
            }

            // 응답
            const resp = Buffer.alloc(4 + 5);
            resp[0] = 0x05;
            resp[1] = 0x64;
            resp.writeUInt16BE(5, 2);
            resp.writeUInt16LE(dstAddr, 4);
            resp.writeUInt16LE(srcAddr, 6);
            resp[8] = 0x83; // Operate response

            socket.write(resp);

          } else {
            console.log('[DNP3] Unsupported FC=%d', fc);
            sendErrorResponse(socket, srcAddr, dstAddr, fc);
          }

          buffer = buffer.slice(totalLength);
        }
      });

      socket.on('error', (err) => {
        console.error('[DNP3] Socket error — %s', err.message);
      });
    });

    function sendErrorResponse(socket, srcAddr, dstAddr, fc) {
      const resp = Buffer.alloc(4 + 6);
      resp[0] = 0x05;
      resp[1] = 0x64;
      resp.writeUInt16BE(6, 2);
      resp.writeUInt16LE(dstAddr, 4);
      resp.writeUInt16LE(srcAddr, 6);
      resp[8] = fc | 0x80;
      resp[9] = 0x01; // error code
      socket.write(resp);
    }

    serverTCP.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error('[DNP3] Port %d already in use — skipping', portNumber);
      } else {
        console.error('[DNP3] Server error — %s', err.message);
      }
    });

    serverTCP.listen(portNumber, () => {
      console.info('[DNP3] Server started — port=%d', portNumber);
    });
  }

};
