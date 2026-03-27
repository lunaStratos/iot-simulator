<template>
  <div>
    <ProtocolSelector v-model="selectedProtocol" />

    <n-grid :cols="2" :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
      <!-- 왼쪽: 디바이스 이미지 -->
      <n-gi span="2 m:1">
        <n-card style="text-align: center; min-height: 340px; display: flex; align-items: center; justify-content: center;">
          <div>
            <img v-if="device.json.switch == 1" src="@/assets/images/boiler.png" style="max-width: 200px;" />
            <img v-else src="@/assets/images/boiler_off.png" style="max-width: 200px;" />
            <div style="margin-top: 12px;">
              <img v-if="device.json.switch == 1" src="@/assets/images/fire.gif" style="max-width: 240px;" />
              <img v-else src="@/assets/images/fireoff.png" style="max-width: 240px;" />
            </div>
          </div>
        </n-card>
      </n-gi>

      <!-- 오른쪽: 디바이스 정보 + 제어 -->
      <n-gi span="2 m:1">
        <n-card>
          <!-- 전원 상태 -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
            <n-tag :type="device.json.switch == 1 ? 'success' : 'error'" size="large" round :bordered="false">
              <template #icon>
                <div :style="{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor', animation: device.json.switch == 1 ? 'pulse 1.5s infinite' : 'none' }" />
              </template>
              {{ device.json.switch == 1 ? 'ON' : 'OFF' }}
            </n-tag>
            <n-switch :value="device.json.switch == 1" @update:value="setControl('switch', $event ? 1 : 0)" size="large" />
          </div>

          <n-descriptions label-placement="left" :column="1" bordered size="small">
            <n-descriptions-item label="IoT이름">
              <n-text strong>{{ device.name || '-' }}</n-text>
            </n-descriptions-item>
            <n-descriptions-item label="Firmware">
              <n-tag size="tiny" :bordered="false">v{{ device.firmware || '-' }}</n-tag>
            </n-descriptions-item>
            <n-descriptions-item label="상태">
              <n-tag :type="device.json.status === 'normal' ? 'success' : 'error'" size="small" :bordered="false">
                {{ device.json.status === 'normal' ? '정상' : '이상' }}
              </n-tag>
            </n-descriptions-item>
            <n-descriptions-item label="습도">
              <n-text>{{ device.json.humidity || 0 }}%</n-text>
            </n-descriptions-item>
          </n-descriptions>
        </n-card>

        <!-- 온도 카드 -->
        <n-card title="온도" size="small" style="margin-top: 16px;">
          <n-grid :cols="2" :x-gap="16">
            <n-gi>
              <n-statistic label="현재온도">
                <n-number-animation :from="0" :to="Number(device.json.now_temperature) || 0" :precision="0" />
                <template #suffix>°C</template>
              </n-statistic>
              <n-progress type="line" :percentage="tempPercent(device.json.now_temperature)" :indicator-placement="'inside'" :color="tempColor(device.json.now_temperature)" style="margin-top: 8px;" />
            </n-gi>
            <n-gi>
              <n-statistic label="희망온도">
                <n-number-animation :from="0" :to="Number(device.json.hope_temperature) || 0" :precision="0" />
                <template #suffix>°C</template>
              </n-statistic>
              <n-progress type="line" :percentage="tempPercent(device.json.hope_temperature)" :indicator-placement="'inside'" :color="tempColor(device.json.hope_temperature)" style="margin-top: 8px;" />
            </n-gi>
          </n-grid>

          <n-divider style="margin: 16px 0 12px;" />
          <n-text depth="3" style="font-size: 12px; margin-bottom: 8px; display: block;">희망온도 설정</n-text>
          <div style="display: flex; align-items: center; gap: 12px;">
            <n-slider :value="Number(control.hope_temperature)" @update:value="control.hope_temperature = $event" :min="16" :max="36" :step="1" style="flex: 1;" @dragend="setControl('hope_temperature', control.hope_temperature)" />
            <n-input-number :value="Number(control.hope_temperature)" @update:value="(v) => { control.hope_temperature = v; setControl('hope_temperature', v); }" :min="16" :max="36" size="small" style="width: 100px;" />
          </div>
        </n-card>

        <!-- 모드 카드 -->
        <n-card title="동작모드" size="small" style="margin-top: 16px;">
          <n-radio-group :value="String(device.json.mode)" @update:value="setControl('mode', $event)" size="small">
            <n-space>
              <n-radio-button v-for="m in modes" :key="m.value" :value="m.value" :label="m.label" />
            </n-space>
          </n-radio-group>
          <div style="margin-top: 12px; text-align: center;">
            <img v-if="device.json.mode == 1" src="@/assets/images/general.png" style="max-width: 120px; border-radius: 8px;" />
            <img v-if="device.json.mode == 2" src="@/assets/images/save.png" style="max-width: 120px; border-radius: 8px;" />
            <img v-if="device.json.mode == 3" src="@/assets/images/shower.png" style="max-width: 120px; border-radius: 8px;" />
            <img v-if="device.json.mode == 4" src="@/assets/images/ondol.jpg" style="max-width: 120px; border-radius: 8px;" />
            <img v-if="device.json.mode == 5" src="@/assets/images/out.png" style="max-width: 120px; border-radius: 8px;" />
            <img v-if="device.json.mode == 6" src="@/assets/images/hotwater.png" style="max-width: 120px; border-radius: 8px;" />
          </div>
        </n-card>
      </n-gi>
    </n-grid>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import axios from 'axios'
import ProtocolSelector from '@/components/ProtocolSelector.vue'
import { useDeviceSocket } from '@/composables/useDeviceSocket'

const selectedProtocol = ref('http')
const device = reactive({ name: '', firmware: '', json: { hope_temperature: 0, now_temperature: 0, humidity: 0, mode: 1, switch: 0, status: 'normal' } })
const control = reactive({ switch: 0, mode: 1, hope_temperature: 25 })

const modes = [
  { label: '난방', value: '1' },
  { label: '절약', value: '2' },
  { label: '샤워', value: '3' },
  { label: '온돌', value: '4' },
  { label: '외출', value: '5' },
  { label: '고온', value: '6' }
]

const tempPercent = (v) => Math.min(100, Math.max(0, ((Number(v) || 0) - 10) / 30 * 100))
const tempColor = (v) => {
  const n = Number(v) || 0
  if (n < 20) return '#2ec4b6'
  if (n < 30) return '#f4a261'
  return '#e63946'
}

useDeviceSocket('1000', selectedProtocol, (data) => {
  if (data.device) {
    Object.assign(device, data.device)
    if (data.device.json) {
      Object.assign(device.json, data.device.json)
      control.switch = data.device.json.switch
      control.mode = data.device.json.mode
      control.hope_temperature = data.device.json.hope_temperature
    }
  }
})

async function setControl(name, value) {
  try {
    await axios.put(`/api/iot/control/1000?protocol=${selectedProtocol.value}`, {
      deviceControl: value,
      deviceControlName: name
    })
  } catch (e) {
    console.error(e)
  }
}
</script>

<style>
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
