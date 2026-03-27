<template>
  <div>
    <ProtocolSelector v-model="selectedProtocol" />

    <n-grid :cols="2" :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
      <!-- 왼쪽: 디바이스 이미지 -->
      <n-gi span="2 m:1">
        <n-card style="text-align: center; min-height: 340px; display: flex; align-items: center; justify-content: center;">
          <div>
            <template v-if="device.json.switch == 1">
              <img :src="lightImage" style="max-width: 280px;" />
            </template>
            <template v-else>
              <img src="@/assets/images/light_off.png" style="max-width: 280px;" />
            </template>
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
          </n-descriptions>
        </n-card>

        <!-- 밝기 카드 -->
        <n-card title="밝기" size="small" style="margin-top: 16px;">
          <n-statistic label="현재 밝기">
            <n-number-animation :from="0" :to="Number(device.json.strength) || 0" :precision="0" />
            <template #suffix>lx</template>
          </n-statistic>
          <n-progress type="line" :percentage="Number(device.json.strength) || 0" :indicator-placement="'inside'" style="margin-top: 8px;" />
          <n-divider style="margin: 16px 0 12px;" />
          <n-text depth="3" style="font-size: 12px; margin-bottom: 8px; display: block;">밝기 설정</n-text>
          <div style="display: flex; align-items: center; gap: 12px;">
            <n-slider :value="Number(control.strength)" @update:value="control.strength = $event" :min="0" :max="100" :step="1" style="flex: 1;" @dragend="setControl('strength', control.strength)" />
            <n-input-number :value="Number(control.strength)" @update:value="(v) => { control.strength = v; setControl('strength', v); }" :min="0" :max="100" size="small" style="width: 100px;" />
          </div>
        </n-card>

        <!-- 색상 카드 -->
        <n-card title="색상" size="small" style="margin-top: 16px;">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <div
              v-for="color in colors"
              :key="color.value"
              @click="setControl('color', color.value)"
              :style="{
                width: '40px', height: '40px', borderRadius: '10px', cursor: 'pointer',
                background: color.value === '#fff' ? '#ffffff' : color.value,
                border: device.json.color === color.value ? '3px solid #63e2b7' : '2px solid rgba(255,255,255,0.15)',
                transition: 'all 0.2s',
                boxShadow: device.json.color === color.value ? '0 0 12px rgba(99,226,183,0.4)' : 'none'
              }"
              :title="color.label"
            />
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
            <img v-if="device.json.mode == 1" src="@/assets/images/normal.png" style="max-width: 120px; border-radius: 8px;" />
            <img v-if="device.json.mode == 2" src="@/assets/images/soft.jpg" style="max-width: 120px; border-radius: 8px;" />
            <img v-if="device.json.mode == 3" src="@/assets/images/disco.png" style="max-width: 120px; border-radius: 8px;" />
            <img v-if="device.json.mode == 4" src="@/assets/images/xmas.png" style="max-width: 120px; border-radius: 8px;" />
          </div>
        </n-card>
      </n-gi>
    </n-grid>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import axios from 'axios'
import ProtocolSelector from '@/components/ProtocolSelector.vue'
import { useDeviceSocket } from '@/composables/useDeviceSocket'

import lightOnImg from '@/assets/images/light_on.png'
import lightOnRedImg from '@/assets/images/light_on_red.png'
import lightOnOrangeImg from '@/assets/images/light_on_orange.png'
import lightOnYellowImg from '@/assets/images/light_on_yellow.png'
import lightOnGreenImg from '@/assets/images/light_on_green.png'
import lightOnBlueImg from '@/assets/images/light_on_blue.png'
import lightOnIndigoImg from '@/assets/images/light_on_indigo.png'
import lightOnPurpleImg from '@/assets/images/light_on_purple.png'

const selectedProtocol = ref('http')
const device = reactive({ name: '', firmware: '', json: { switch: 0, color: '#fff', strength: 0, mode: 1, status: 'normal' } })
const control = reactive({ switch: 0, mode: 1, strength: 25 })

const colorImageMap = {
  '#fff': lightOnImg,
  '#f05348': lightOnRedImg,
  '#f08848': lightOnOrangeImg,
  '#f0c048': lightOnYellowImg,
  '#48f072': lightOnGreenImg,
  '#486af0': lightOnBlueImg,
  '#8348f0': lightOnIndigoImg,
  '#1d0f6b': lightOnPurpleImg
}

const lightImage = computed(() => colorImageMap[device.json.color] || lightOnImg)

const colors = [
  { value: '#fff', label: 'White' },
  { value: '#f05348', label: 'Red' },
  { value: '#f08848', label: 'Orange' },
  { value: '#f0c048', label: 'Yellow' },
  { value: '#48f072', label: 'Green' },
  { value: '#486af0', label: 'Blue' },
  { value: '#8348f0', label: 'Indigo' },
  { value: '#1d0f6b', label: 'Purple' }
]

const modes = [
  { label: '일반', value: '1' },
  { label: '은은한', value: '2' },
  { label: '깜빡임', value: '3' },
  { label: '산타', value: '4' }
]

useDeviceSocket('2000', selectedProtocol, (data) => {
  if (data.device) {
    Object.assign(device, data.device)
    if (data.device.json) {
      Object.assign(device.json, data.device.json)
      control.switch = data.device.json.switch
      control.mode = data.device.json.mode
      control.strength = data.device.json.strength || 0
    }
  }
})

async function setControl(name, value) {
  try {
    await axios.put(`/api/iot/control/2000?protocol=${selectedProtocol.value}`, {
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
