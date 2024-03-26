<template>
    <div>
      <v-swatches v-model="color" :swatches="swatches" v-on="listeners" show-border="true"></v-swatches>
    </div>
  </template>
  
  <script>
  import VSwatches from "vue-swatches";
  import "vue-swatches/dist/vue-swatches.css";
  
  export default {
    components: { VSwatches },
    data () {
        return {
        swatches: ['#fff', '#f05348', '#f08848', '#f0c048', '#48f072', '#486af0', '#1d0f6b', '#8348f0'],
        }
  },
    props: ["color"],
    computed: {
      listeners() {
        return {
          ...this.$listeners,
          input: this.updateColorValue
        };
      }
    },
    methods: {
        updateColorValue(event) {
            console.log("update color event ", event)
            this.$emit("inputColor", event);
      },

    },
  };
  </script>