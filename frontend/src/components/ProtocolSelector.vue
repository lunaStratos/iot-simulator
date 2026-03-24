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
        {{ modelValue.toUpperCase() }} :{{ portMap[modelValue] }}
      </n-tag>
    </div>
  </n-card>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: String, default: 'http' }
})
defineEmits(['update:modelValue'])

const protocols = [
  { label: 'HTTP', value: 'http' },
  { label: 'MQTT', value: 'mqtt' },
  { label: 'CoAP', value: 'coap' },
  { label: 'BACnet', value: 'bacnet' },
  { label: 'OPC-UA', value: 'opcua' },
  { label: 'Modbus', value: 'modbus' }
]

const portMap = {
  http: 3000, mqtt: 1883, coap: 5683, bacnet: 47808, opcua: 4840, modbus: 5020
}
</script>
