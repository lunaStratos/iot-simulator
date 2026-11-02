<template>
  <div>
    <ProtocolSelector v-model="selectedProtocol" device-id="3000" />

    <n-grid :cols="2" :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
      <!-- 왼쪽: 온도계 그래픽 -->
      <n-gi span="2 m:1">
        <n-card style="text-align: center; min-height: 340px; display: flex; align-items: center; justify-content: center;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
            <div class="thermo">
              <div class="thermo-tube">
                <div class="thermo-fill" :style="{ height: tempPercent(device.json.temperature) + '%', background: tempColor(device.json.temperature) }" />
              </div>
              <div class="thermo-bulb" :style="{ background: tempColor(device.json.temperature) }" />
            </div>
            <div :style="{ fontSize: '40px', fontWeight: 700, color: tempColor(device.json.temperature) }">
              {{ formatTemp(device.json.temperature) }}°C
            </div>
          </div>
        </n-card>
      </n-gi>

      <!-- 오른쪽: 디바이스 정보 + 제어 -->
      <n-gi span="2 m:1">
        <n-card>
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
          </n-descriptions>
        </n-card>

        <!-- 온도 카드 -->
        <n-card title="온도" size="small" style="margin-top: 16px;">
          <n-statistic label="현재온도">
            <n-number-animation :from="0" :to="Number(device.json.temperature) || 0" :precision="1" />
            <template #suffix>°C</template>
          </n-statistic>
          <n-progress type="line" :percentage="tempPercent(device.json.temperature)" :show-indicator="false" :color="tempColor(device.json.temperature)" style="margin-top: 8px;" />

          <n-divider style="margin: 16px 0 12px;" />
          <n-text depth="3" style="font-size: 12px; margin-bottom: 8px; display: block;">온도 설정 ({{ TEMP_MIN }} ~ {{ TEMP_MAX }}°C)</n-text>
          <div style="display: flex; align-items: center; gap: 12px;">
            <n-slider :value="Number(control.temperature)" @update:value="control.temperature = $event" :min="TEMP_MIN" :max="TEMP_MAX" :step="0.1" style="flex: 1;" @dragend="setControl('temperature', control.temperature)" />
            <n-input-number :value="Number(control.temperature)" @update:value="onInputTemp" :min="TEMP_MIN" :max="TEMP_MAX" :step="0.1" :precision="1" size="small" style="width: 110px;" />
          </div>
          <n-space style="margin-top: 12px;" size="small">
            <n-button v-for="t in presets" :key="t" size="small" secondary @click="setTemp(t)">{{ t }}°C</n-button>
          </n-space>
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

const DEVICE_ID = '3000'
const TEMP_MIN = -20
const TEMP_MAX = 50
const presets = [0, 18, 22, 26, 30]

const selectedProtocol = ref('http')
const device = reactive({ name: '', firmware: '', json: { temperature: 0, status: 'normal' } })
const control = reactive({ temperature: 0 })

const formatTemp = (v) => (Number(v) || 0).toFixed(1)
const tempPercent = (v) => Math.min(100, Math.max(0, ((Number(v) || 0) - TEMP_MIN) / (TEMP_MAX - TEMP_MIN) * 100))
const tempColor = (v) => {
  const n = Number(v) || 0
  if (n < 10) return '#4ea8de'
  if (n < 20) return '#2ec4b6'
  if (n < 30) return '#f4a261'
  return '#e63946'
}

useDeviceSocket(DEVICE_ID, selectedProtocol, (data) => {
  if (data.device) {
    // json 은 교체하지 않고 병합 — 프로토콜이 제공하지 않는 속성(status 등)은 이전 값 유지
    Object.assign(device, { ...data.device, json: device.json })
    if (data.device.json) {
      Object.assign(device.json, data.device.json)
      if (data.device.json.temperature !== undefined) {
        control.temperature = Number(data.device.json.temperature) || 0
      }
    }
  }
})

function onInputTemp(v) {
  if (v === null) return
  setTemp(v)
}

function setTemp(v) {
  control.temperature = v
  setControl('temperature', v)
}

async function setControl(name, value) {
  try {
    await axios.put(`/api/iot/control/${DEVICE_ID}?protocol=${selectedProtocol.value}`, {
      deviceControl: name === 'temperature' ? Math.round(Number(value) * 10) / 10 : value,
      deviceControlName: name
    })
  } catch (e) {
    console.error(e)
  }
}
</script>

<style scoped>
.thermo {
  position: relative;
  width: 56px;
  height: 230px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.thermo-tube {
  position: relative;
  width: 24px;
  height: 190px;
  border-radius: 12px 12px 0 0;
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-bottom: none;
  overflow: hidden;
}
.thermo-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  transition: height 0.4s ease, background 0.4s ease;
}
.thermo-bulb {
  width: 52px;
  height: 52px;
  margin-top: -12px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  transition: background 0.4s ease;
}
</style>
