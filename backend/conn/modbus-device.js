const net = require('net');
const storage = require('../config/storage');

const portNumber = 5020;

const registerMap = {
  0: { deviceId: 1000, name: 'hope_temperature' },
  1: { deviceId: 1000, name: 'now_temperature' },
  2: { deviceId: 1000, name: 'humidity' },
  3: { deviceId: 1000, name: 'mode' },
  4: { deviceId: 1000, name: 'switch' },
  100: { deviceId: 2000, name: 'switch' },
  101: { deviceId: 2000, name: 'strength' },
  102: { deviceId: 2000, name: 'mode' }
};

const holdingRegisters = {};

function refreshRegisters() {
  for (const [addr, mapping] of Object.entries(registerMap)) {
    const val = storage.getValue(mapping.deviceId, mapping.name);
    holdingRegisters[addr] = parseInt(val) || 0;
  }
}

module.exports = {

  connect() {
    refreshRegisters();
    setInterval(refreshRegisters, 3000);

    const serverTCP = net.createServer((socket) => {
      console.log('[Modbus] Client connected — %s:%s', socket.remoteAddress, socket.remotePort);

      socket.on('data', (data) => {
        if (data.length < 12) return;

        const transactionId = data.readUInt16BE(0);
        const protocolId = data.readUInt16BE(2);
        const unitId = data[6];
        const functionCode = data[7];

        if (functionCode === 3) {
          const startAddr = data.readUInt16BE(8);
          const quantity = data.readUInt16BE(10);
          console.log('[Modbus] FC03 ReadHoldingRegisters — start=%d qty=%d unitId=%d', startAddr, quantity, unitId);

          const byteCount = quantity * 2;
          const response = Buffer.alloc(9 + byteCount);
          response.writeUInt16BE(transactionId, 0);
          response.writeUInt16BE(protocolId, 2);
          response.writeUInt16BE(3 + byteCount, 4);
          response[6] = unitId;
          response[7] = functionCode;
          response[8] = byteCount;

          for (let i = 0; i < quantity; i++) {
            const addr = startAddr + i;
            const val = holdingRegisters[addr] || 0;
            response.writeUInt16BE(val & 0xFFFF, 9 + i * 2);
          }

          socket.write(response);

        } else if (functionCode === 6) {
          const registerAddr = data.readUInt16BE(8);
          const registerValue = data.readUInt16BE(10);

          const mapping = registerMap[registerAddr];
          if (mapping) {
            console.log('[Modbus] FC06 WriteSingleRegister — addr=%d %s=%d', registerAddr, mapping.name, registerValue);
            holdingRegisters[registerAddr] = registerValue;
            storage.setValue(mapping.deviceId, mapping.name, registerValue);
          } else {
            console.log('[Modbus] FC06 WriteSingleRegister — addr=%d (unmapped)', registerAddr);
          }

          const response = Buffer.alloc(12);
          data.copy(response, 0, 0, 12);
          socket.write(response);

        } else {
          console.log('[Modbus] Unsupported FC=%d — returning exception', functionCode);
          const response = Buffer.alloc(9);
          response.writeUInt16BE(transactionId, 0);
          response.writeUInt16BE(protocolId, 2);
          response.writeUInt16BE(3, 4);
          response[6] = unitId;
          response[7] = functionCode | 0x80;
          response[8] = 0x01;
          socket.write(response);
        }
      });

      socket.on('error', (err) => {
        console.error('[Modbus] Socket error — %s', err.message);
      });
    });

    serverTCP.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error('[Modbus] Port %d already in use — skipping', portNumber);
      } else {
        console.error('[Modbus] Server error — %s', err.message);
      }
    });

    serverTCP.listen(portNumber, () => {
      console.info('[Modbus] Server started — port=%d', portNumber);
    });
  }

};
