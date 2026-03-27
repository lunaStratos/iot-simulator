/**
 * Socket.IO 서버 — 디바이스 상태 실시간 push
 */
const { Server } = require('socket.io');
const storage = require('./storage');
const protocolClient = require('../conn/protocol-client');

let io = null;

// 소켓별 구독 정보: socketId -> { deviceId, protocol }
const subscriptions = new Map();

// 디바이스별 debounce 타이머 (batch setValue 병합용)
const debounceTimers = new Map();

/**
 * 디바이스 상태를 조회하여 반환
 */
async function fetchDeviceStatus(deviceId, protocol) {
  if (protocol && protocol !== 'http') {
    try {
      const data = await protocolClient.getStatus(protocol, deviceId);
      data.protocol = protocol;
      return data;
    } catch (e) {
      // fallback to storage
    }
  }
  const device = storage.getDevice(deviceId);
  return { device, protocol: protocol || 'http' };
}

/**
 * 특정 디바이스 룸의 모든 소켓에 상태 push
 */
async function pushToRoom(deviceId) {
  if (!io) return;

  const room = `device:${deviceId}`;
  const sockets = await io.in(room).fetchSockets();

  for (const socket of sockets) {
    const sub = subscriptions.get(socket.id);
    if (!sub) continue;
    const data = await fetchDeviceStatus(deviceId, sub.protocol);
    socket.emit('deviceStatus', data);
  }
}

/**
 * debounce된 push (batch에서 setValue 연속 호출 시 병합)
 */
function debouncedPush(deviceId) {
  if (debounceTimers.has(deviceId)) {
    clearTimeout(debounceTimers.get(deviceId));
  }
  debounceTimers.set(deviceId, setTimeout(() => {
    debounceTimers.delete(deviceId);
    pushToRoom(deviceId);
  }, 100));
}

module.exports = {
  /**
   * HTTP 서버에 Socket.IO 바인딩
   */
  init(httpServer) {
    io = new Server(httpServer, {
      cors: { origin: '*' }
    });

    // storage 변경 감지 → push
    storage.events.on('change', ({ deviceId }) => {
      debouncedPush(deviceId);
    });

    io.on('connection', (socket) => {
      console.log('[Socket] connected — id=%s', socket.id);

      socket.on('subscribe', async ({ deviceId, protocol }) => {
        // 이전 구독 정리
        const prev = subscriptions.get(socket.id);
        if (prev) {
          socket.leave(`device:${prev.deviceId}`);
        }

        subscriptions.set(socket.id, { deviceId, protocol });
        socket.join(`device:${deviceId}`);
        console.log('[Socket] subscribe — id=%s device=%s protocol=%s', socket.id, deviceId, protocol);

        // 즉시 현재 상태 전송
        const data = await fetchDeviceStatus(deviceId, protocol);
        socket.emit('deviceStatus', data);
      });

      socket.on('unsubscribe', () => {
        const sub = subscriptions.get(socket.id);
        if (sub) {
          socket.leave(`device:${sub.deviceId}`);
          subscriptions.delete(socket.id);
          console.log('[Socket] unsubscribe — id=%s', socket.id);
        }
      });

      socket.on('disconnect', () => {
        subscriptions.delete(socket.id);
        console.log('[Socket] disconnected — id=%s', socket.id);
      });
    });

    console.log('[Socket] initialized');
  }
};
