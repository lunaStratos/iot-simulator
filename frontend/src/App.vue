<template>
  <v-app>
    <core-app-bar />
    <core-view />
    <core-footer />
  </v-app>
</template>

<script>
import CoreAppBar from '@/components/core/Header'
import CoreView from '@/components/indexPage'
import CoreFooter from '@/components/core/Footer'
import './assets/css/main.css'

export default {
  name: 'App',
  components: {
    CoreAppBar,
    CoreView,
    CoreFooter
  },
};
</script>