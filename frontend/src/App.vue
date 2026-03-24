<template>
  <n-config-provider :theme="darkTheme">
    <n-global-style />
    <n-message-provider>
      <n-layout style="min-height: 100vh;">
        <n-layout-header bordered style="padding: 0 24px; display: flex; align-items: center; height: 56px; gap: 24px;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 700; white-space: nowrap;">
            <n-icon size="22"><ServerOutline /></n-icon>
            IoT Simulator
          </div>
          <n-menu mode="horizontal" :value="currentRoute" :options="menuOptions" @update:value="onMenuSelect" />
          <div style="margin-left: auto;">
            <n-tag :bordered="false" type="info" size="small" round>
              5 Protocols
            </n-tag>
          </div>
        </n-layout-header>
        <n-layout-content content-style="padding: 24px; max-width: 1000px; margin: 0 auto; width: 100%;">
          <router-view />
        </n-layout-content>
      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { computed, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { darkTheme } from 'naive-ui'
import { NIcon } from 'naive-ui'
import { ServerOutline, FlameOutline, BulbOutline, BookOutline } from '@vicons/ionicons5'

const router = useRouter()
const route = useRoute()

const currentRoute = computed(() => route.path)

const renderIcon = (icon) => () => h(NIcon, null, { default: () => h(icon) })

const menuOptions = [
  { label: 'Boiler', key: '/', icon: renderIcon(FlameOutline) },
  { label: 'Smart LED', key: '/switch', icon: renderIcon(BulbOutline) },
  { label: 'Protocol Guide', key: '/guide', icon: renderIcon(BookOutline) }
]

const onMenuSelect = (key) => router.push(key)
</script>
