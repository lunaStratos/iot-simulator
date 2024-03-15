
<!-- 
    IoT보일러 
    - output데이터 : now_temperature, hope_temperature, switch, humidity, mode(난방, 절약, 목욕, 온돌, 외출, 온수), status(정상, 이상)
    - input 데이터 : hope_temperature, switch, mode(난방, 절약, 목욕, 온돌, 외출, 온수)
-->
<template>
    <!-- Content here -->
    <div class="container">
        <div class="row">
            <div class="col">
                <img src = "@/assets/images/boiler.png" />
            </div>
            <div class="col">
                
                <div class="row">
                    <div class="col switch" :class="{'bg-success' : device.switch === 1, 'bg-danger' : device.switch ===0}">
                        <!-- if work : success color, or fail color-->
                       {{ device.switch === 1 ? "ON" : "OFF"  }}
                    </div>
                    <div class="w-100"></div>
                    <div class="col bg-light fw-bold">IoT이름</div>
                    <div class="col">{{ device.name }}</div>
                    <div class="w-100"></div>
                    <div class="col bg-light fw-bold">firmware version</div>
                    <div class="col">{{ device.firmware }}</div>
                    <div class="w-100"></div>
                    <div class="col bg-light fw-bold">현재온도</div>
                    <div class="col">{{ device.now_temperature }}°C</div>
                    <div class="w-100"></div>
                    <div class="col bg-light fw-bold">희망온도</div>
                    <div class="col">{{ device.hope_temperature }}°C</div>
                    <div class="w-100"></div>
                    <div class="col bg-light fw-bold">습도</div>
                    <div class="col">{{ device.humidity }}%</div>
                    <div class="w-100"></div>
                    <div class="col bg-light fw-bold">동작모드</div>
                    <div class="col">
                        <select class="form-select"  v-bind="control.mode" @change="setControl('mode')">
                            <option value="1">난방</option>
                            <option value="2">절약</option>
                            <option value="3">샤워</option>
                            <option value="4">온돌</option>
                            <option value="5">외출</option>
                            <option value="6">고온</option>
                        </select>
                        <template v-if="device.mode == 1" >
                            <img src="@/assets/images/general.png" class="img-thumbnail"/>
                        </template>
                        <template v-if="device.mode == 2" >
                            <img src="@/assets/images/save.png" class="img-thumbnail"/>
                        </template>
                        <template v-if="device.mode == 3" >
                            <img src="@/assets/images/shower.png" class="img-thumbnail"/>
                        </template>
                        <template v-if="device.mode == 4" >
                            <img src="@/assets/images/ondol.jpg" class="img-thumbnail"/>
                        </template>
                        <template v-if="device.mode == 5" >
                            <img src="@/assets/images/out.png" class="img-thumbnail" />
                        </template>
                        <template v-if="device.mode == 6" >
                            <img src="@/assets/images/hotwater.png" class="img-thumbnail"/>
                        </template>
                    </div>
                    <div class="w-100"></div>
                    <div class="col bg-light fw-bold">상태</div>
                    <div class="col">
                        <template v-if="device.status == 'normal'">
                            정상
                        </template>
                        <template v-if="device.status == 'error'">
                            이상
                        </template>
                    </div>
                    <div class="w-100"></div>
                    <div class="col bg-light fw-bold">전원</div>
                    <div class="col">
                        <div class="form-switch form-switch-xl">
                            <input class="form-check-input" type="checkbox" role="switch" id="flexSwitchCheckDefault" 
                            v-model="control.switch" true-value="1" false-value="0" @change="setControl('switch')">
                            <label class="form-check-label" for="flexSwitchCheckDefault"></label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
    </div>
</template>

<script>
import { reactive } from 'vue'

export default {
    data() {
        return {
            device: {},
            control : {switch: 0, mode : 1}
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
            .get('/api/iot/status/1000')
            .then((res) => {
                const device = res.data.device;
                // console.log(device);
                if (device){
                    this.device = device;
                    this.control.switch = device.switch;
                }
            })
            .catch((error) => {
                console.error(error);
        });
      },
      setControl : function(event){
        const json = JSON.stringify({ deviceControl: this.control.switch , deviceControlName : event});
        this.$http
            .put('/api/iot/control/1000', json, {
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
    }
    }
</script>