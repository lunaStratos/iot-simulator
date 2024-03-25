<template>
  <v-app>
    <core-app-bar />
    <router-view />
    <core-footer />
  </v-app>
</template>

<script>
import CoreAppBar from '@/components/core/Header'
import CoreFooter from '@/components/core/Footer'
import './assets/css/main.css'



export default {
  name: 'App',
  components: {
    CoreAppBar,
    CoreFooter,
    
  },
};
</script>