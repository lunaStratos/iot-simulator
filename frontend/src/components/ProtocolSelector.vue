<template>
  <n-card size="small" style="margin-bottom: 16px;">
    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
      <n-text depth="3" style="font-size: 13px; font-weight: 600;">PROTOCOL</n-text>
      <n-radio-group :value="modelValue" @update:value="$emit('update:modelValue', $event)" size="small">
        <n-radio-button v-for="p in protocols" :key="p.value" :value="p.value" :label="p.label" />
      </n-radio-group>
      <n-tag :bordered="false" type="info" size="small" round>
        <template #icon>
          <div style="width: 6px; height: 6px; border-radius: 50%; background: currentColor;" />
        </template>
        {{ modelValue.toUpperCase() }} :{{ current ? current.port : portMap[modelValue] }}
        <template v-if="current"> / {{ current.transport }}</template>
      </n-tag>
    </div>

    <!-- 접속 정보 -->
    <div v-if="current" style="margin-top: 12px; display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 280px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <n-text depth="3" style="font-size: 13px; font-weight: 600;">CONNECTION — {{ current.name }}</n-text>
          <n-tag v-if="current.status" :type="current.status.type" size="small" :bordered="false" round>
            {{ current.status.text }}
          </n-tag>
        </div>

        <n-descriptions label-placement="left" :column="1" bordered size="small" label-style="width: 150px; white-space: nowrap;">
          <n-descriptions-item v-for="row in current.rows" :key="row.label" :label="row.label">
            <div style="display: flex; align-items: center; gap: 6px;">
              <n-text code style="word-break: break-all;">{{ row.value }}</n-text>
              <n-button text size="tiny" style="margin-left: auto;" @click="copy(row.value)">
                <template #icon><n-icon><CopyOutline /></n-icon></template>
              </n-button>
            </div>
          </n-descriptions-item>
        </n-descriptions>

        <n-text v-for="note in current.notes || []" :key="note" depth="3" style="display: block; font-size: 12px; margin-top: 6px;">
          ※ {{ note }}
        </n-text>

        <n-collapse v-if="current.points" style="margin-top: 8px;">
          <n-collapse-item :title="`포인트 매핑 — 디바이스 ${deviceId} (${current.points.length})`" name="points">
            <n-table v-if="current.points.length" :bordered="true" :single-line="false" size="small">
              <thead><tr><th>속성</th><th>주소</th></tr></thead>
              <tbody>
                <tr v-for="pt in current.points" :key="pt.prop + pt.address">
                  <td>{{ pt.prop }}</td>
                  <td><n-text code>{{ pt.address }}</n-text></td>
                </tr>
              </tbody>
            </n-table>
            <n-text v-else depth="3" style="font-size: 13px;">이 디바이스는 {{ current.name }} 에 매핑된 포인트가 없습니다.</n-text>
          </n-collapse-item>
        </n-collapse>
      </div>

      <div v-if="current.qr" style="text-align: center;">
        <n-qr-code :value="current.qr" :size="120" style="padding: 8px; background: #fff; border-radius: 8px;" />
        <n-text depth="3" style="display: block; font-size: 12px; margin-top: 4px;">페어링 QR</n-text>
      </div>
    </div>
  </n-card>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'
import { useMessage } from 'naive-ui'
import { CopyOutline } from '@vicons/ionicons5'

const props = defineProps({
  modelValue: { type: String, default: 'http' },
  deviceId: { type: String, default: '1000' }
})
defineEmits(['update:modelValue'])

const message = useMessage()

const protocols = [
  { label: 'HTTP', value: 'http' },
  { label: 'MQTT', value: 'mqtt' },
  { label: 'CoAP', value: 'coap' },
  { label: 'BACnet', value: 'bacnet' },
  { label: 'OPC-UA', value: 'opcua' },
  { label: 'Modbus', value: 'modbus' },
  { label: 'DNP3', value: 'dnp3' },
  { label: 'IEC 61850', value: 'iec61850' },
  { label: 'HomeKit', value: 'homekit' },
  { label: 'Matter', value: 'matter' }
]

// 접속 정보 로드 전 표시용 기본 포트
const portMap = {
  http: 41234, mqtt: 1883, coap: 5683, bacnet: 47808, opcua: 4840, modbus: 5020,
  dnp3: 20000, iec61850: 10200, homekit: 51827, matter: 5541
}

const connections = ref([])
const current = computed(() => connections.value.find(p => p.id === props.modelValue))

// 프로토콜 전환 시마다 다시 조회 — 페어링/커미셔닝 상태 갱신
async function loadConnections() {
  try {
    const { data } = await axios.get('/api/iot/protocols', { params: { deviceId: props.deviceId } })
    connections.value = data.protocols
  } catch (e) {
    console.error(e)
  }
}

onMounted(loadConnections)
watch(() => props.modelValue, loadConnections)

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    message.success('복사됨')
  } catch (e) {
    // http://<LAN IP> 처럼 보안 컨텍스트가 아니면 clipboard API 사용 불가
    message.warning('클립보드에 복사할 수 없습니다')
  }
}
</script>
