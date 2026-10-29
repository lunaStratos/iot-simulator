import { createRouter, createWebHistory } from 'vue-router'
import BoilerPage from '@/pages/BoilerPage.vue'
import SwitchPage from '@/pages/SwitchPage.vue'
import ThermometerPage from '@/pages/ThermometerPage.vue'
import ProtocolGuidePage from '@/pages/ProtocolGuidePage.vue'

const routes = [
  { path: '/', name: 'Boiler', component: BoilerPage },
  { path: '/switch', name: 'Switch', component: SwitchPage },
  { path: '/thermometer', name: 'Thermometer', component: ThermometerPage },
  { path: '/guide', name: 'ProtocolGuide', component: ProtocolGuidePage }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
