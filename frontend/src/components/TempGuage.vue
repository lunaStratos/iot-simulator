<template>
  <VueSvgGauge class="h-100 d-inline-block"
    :start-angle="-90"
    :end-angle="90"
    :value=22
    :separator-step="2"
    :separator-thickness="2"
    :min="10"
    :max="40"
    :gauge-color="[
        { offset: 0, color: '#BC1E58' },
        { offset: 50, color: '#F0A815' },
        { offset: 100, color: '#2FA325' },
    ]"                            
    :scale-interval="1">
    <div class="inner-text">
        <p>{{ 22 }}</p>
    </div>
  </VueSvgGauge>
</template>
  
  <script>
    import { VueSvgGauge } from "vue-svg-gauge";
    export default {
      name: "TempGuage",
      data() {
        return {
          childVaule: "",
        };
      },
      
    };
  </script>
  