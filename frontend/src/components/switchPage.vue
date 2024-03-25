
<!-- 
    스마트스위치  
    - output데이터 : mode(1:일반, 2: 은은, 3: 깜빡, 4: 싼타), switch (0: off, 1: on), strength : 빛 강도 (1,2,3,4)
    - input 데이터 : 
-->
<template>
  <!-- Content here -->
  <div class="container">
      <div class="row">
          <div class="col">
              <img v-if="device.json.switch == 1 && device.json.color == '#fff' " src="@/assets/images/light_on.png"  style="max-width: 360px;"/>
              <img v-if="device.json.switch == 1 && device.json.color == '#f05348' " src="@/assets/images/light_on.png"  style="max-width: 360px;"/>
              <img v-if="device.json.switch == 1 && device.json.color == '#f08848' " src="@/assets/images/light_on.png"  style="max-width: 360px;"/>
              <img v-if="device.json.switch == 1 && device.json.color == '#f0c048' " src="@/assets/images/light_on.png"  style="max-width: 360px;"/>
              <img v-if="device.json.switch == 1 && device.json.color == '#48f072' " src="@/assets/images/light_on.png"  style="max-width: 360px;"/>
              <img v-if="device.json.switch == 1 && device.json.color == '#486af0' " src="@/assets/images/light_on.png"  style="max-width: 360px;"/>
              <img v-if="device.json.switch == 1 && device.json.color == '#8348f0' " src="@/assets/images/light_on.png"  style="max-width: 360px;"/>
              <img v-if="device.json.switch == 1 && device.json.color == '#1d0f6b' " src="@/assets/images/light_on.png"  style="max-width: 360px;"/>
              <img v-if="device.json.switch == 0" src="@/assets/images/light_off.png" style="max-width: 360px;"/>
              <!-- -->
          </div>
          
          <div class="col">
              
              <div class="row">
                  <div class="col switch" :class="{'bg-success' : device.json.switch === 1, 'bg-danger' : device.json.switch ===0}">
                      <!-- if work : success color, or fail color-->
                     {{ device.json.switch === 1 ? "ON" : "OFF"  }}
                  </div>
                  <div class="w-100"></div>
                  <div class="col bg-light fw-bold">IoT이름</div>
                  <div class="col">{{ device.name }}</div>
                  <div class="w-100"></div>
                  <div class="col bg-light fw-bold">firmware version</div>
                  <div class="col">{{ device.firmware }}</div>
                  <div class="w-100"></div>
                  <div class="col bg-light fw-bold">희망빛 강도</div>
                  <div class="col">
                      <div style="height: 100px">
                          <VueSvgGauge class="h-100 d-inline-block"
                          :start-angle="-90"
                          :end-angle="90"
                          :value=device.json.strength
                          :separator-step="2"
                          :separator-thickness="2"
                          :min="0"
                          :max="100"
                          :gauge-color="[
                              { offset: 30, color: '#2FA325' },
                              { offset: 60, color: '#F0A815' },
                              { offset: 100, color: '#BC1E58' },
                          ]"                            
                          :scale-interval="1">
                          <div class="inner-text">
                              <p>{{ device.json.strength }}</p>
                          </div>
                          </VueSvgGauge>
                      </div>
                      <!-- 희망온도 -->
                      
                  
                      <div class="input-group mb-3">
                          <input type="text" class="form-control someInput" aria-label="strength" v-model="control.strength">
                          <span class="input-group-text">lx</span>
                      </div>
                      <div class="input-group mb-3">
                          <button type="button" class="btn btn-secondary btn-sm" @click="setControl('strength', $event)">조절하기</button>
                      </div>

                  </div>
                  <div class="w-100"></div>
                  <div class="col bg-light fw-bold"></div>
                  <div class="col"></div>
                  <div class="w-100"></div>
                  <div class="col bg-light fw-bold">색상선택</div>
                  <div class="col">
                      <color-picker :color="device.json.color" @inputColor="setControl('color', $event)" />

                      <!-- <select class="form-select"  v-bind="control.color" @change="setControl('color', $event)">
                          <option value="1" style="background: red; color: #fff;">RED</option>
                          <option value="2" style="background: orange; color: #fff;">Orange</option>
                          <option value="3" style="background: yellow; color: #fff;">Yellow</option>
                          <option value="4" style="background: green; color: #fff;">Green</option>
                          <option value="5" style="background: blue; color: #fff;">Blue</option>
                          <option value="6" style="background: indigo; color: #fff;">Indigo</option>
                          <option value="7" style="background: purple; color: #fff;">Purple</option>
                      </select> -->

                      
                      
                  </div>
                  <div class="w-100"></div>
                  <div class="col bg-light fw-bold">동작모드</div>
                  <div class="col">
                      <select class="form-select"  v-bind="control.mode" @change="setControl('mode', $event)">
                          <option value="1">일반</option>
                          <option value="2">은은한</option>
                          <option value="3">깜빡임</option>
                          <option value="4">산타</option>
                      </select>
                      <template v-if="device.json.mode == 1" >
                          <img src="@/assets/images/normal.png" class="img-thumbnail"/>
                      </template>
                      <template v-if="device.json.mode == 2" >
                          <img src="@/assets/images/soft.jpg" class="img-thumbnail"/>
                      </template>
                      <template v-if="device.json.mode == 3" >
                          <img src="@/assets/images/disco.png" class="img-thumbnail"/>
                      </template>
                      <template v-if="device.json.mode == 4" >
                          <img src="@/assets/images/xmas.png" class="img-thumbnail"/>
                      </template>
                  </div>
                  <div class="w-100"></div>
                  <div class="col bg-light fw-bold">상태</div>
                  <div class="col">
                      <template v-if="device.json.status == 'normal'">
                          정상
                      </template>
                      <template v-if="device.json.status == 'error'">
                          이상
                      </template>
                  </div>
                  <div class="w-100"></div>
                  <div class="col bg-light fw-bold">전원</div>
                  <div class="col">
                      <div class="form-switch form-switch-xl">
                          <input class="form-check-input" type="checkbox" role="switch" id="flexSwitchCheckDefault" 
                          v-model="control.switch" true-value="1" false-value="0" @change="setControl('switch', $event)">
                          <label class="form-check-label" for="flexSwitchCheckDefault"></label>
                      </div>
                  </div>
              </div>
          </div>
      </div>
      
  </div>

</template>

<script>

import ColorPicker from "./ColorPicker";

export default {
    components : {
        ColorPicker   
    },
  data() {
      return {
          device: {},
          control : {
              switch: 0, mode : 1 , strength: 25
          }
          
      };
  },
  created() {
    
  },
  methods : {
    checkArr : function() {
      console.log(this.control);
    },
    getStatus : function(){
      this.$http
          .get('/api/iot/status/2000')
          .then((res) => {
              const device = res.data.device;
              if (device){
                  this.device = device;
                  this.control.switch = device.json.switch;
                  this.control.mode = device.json.mode;
              }
          })
          .catch((error) => {
              console.error(error);
      });
    },
    setControl : function(col, event){
      
      console.log(event, col, this.control)

      let deviceControl;

      //color value == event 
      if(col === "switch"){
          deviceControl = event.target.checked ? 1 : 0
      }else if(col === "strength"){
          deviceControl = this.control.strength
      }else if(col === "color"){
        deviceControl = event;
      }else{
        deviceControl =  event.target.value;
      }

      console.log(deviceControl, col)
      const json = JSON.stringify({ deviceControl: deviceControl, deviceControlName : col});
      this.$http
          .put('/api/iot/control/2000', json, {
              headers : {
                  "Content-Type": "application/json",
              }
          })
          .then((res) => {
              console.log(res.data);
          })
          .catch((error) => {
              console.error(error);
      });
    }
    
  },
  mounted(){
      this.loading = setInterval(this.getStatus, 3000)
  },
  
}
</script>
