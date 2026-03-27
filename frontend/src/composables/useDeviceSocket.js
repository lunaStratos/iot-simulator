import { watch, onBeforeUnmount } from 'vue'
import { io } from 'socket.io-client'

/**
 * 디바이스 상태를 WebSocket으로 수신하는 컴포저블
 *
 * @param {string} deviceId - 디바이스 ID (예: '1000')
 * @param {import('vue').Ref<string>} protocolRef - 선택된 프로토콜 ref
 * @param {(data: object) => void} onStatus - 상태 수신 콜백
 */
export function useDeviceSocket(deviceId, protocolRef, onStatus) {
  const socket = io({ path: '/socket.io' })

  function subscribe() {
    socket.emit('subscribe', {
      deviceId,
      protocol: protocolRef.value
    })
  }

  // 연결(재연결 포함) 시 구독
  socket.on('connect', subscribe)

  // 상태 수신
  socket.on('deviceStatus', (data) => {
    onStatus(data)
  })

  // 프로토콜 변경 시 재구독
  watch(protocolRef, () => {
    if (socket.connected) {
      socket.emit('unsubscribe')
      subscribe()
    }
  })

  onBeforeUnmount(() => {
    socket.disconnect()
  })
}
