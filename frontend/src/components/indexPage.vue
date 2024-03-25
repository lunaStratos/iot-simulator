
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
                <img v-if="device.json.switch == 1" src="@/assets/images/boiler.png" />
                <img v-if="device.json.switch == 0" src="@/assets/images/boiler_off.png" />
                <img v-if="device.json.switch == 1" src="@/assets/images/fire.gif" style="max-width: 360px;"/>
                <img v-if="device.json.switch == 0" src="@/assets/images/fireoff.png" style="max-width: 360px;"/>
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
                    <div class="col bg-light fw-bold">현재온도</div>
                    <div class="col">
                        <div style="height: 100px">
                            <VueSvgGauge class="h-100 d-inline-block"
                            :start-angle="-90"
                            :end-angle="90"
                            :value=device.json.now_temperature
                            :separator-step="2"
                            :separator-thickness="2"
                            :min="10"
                            :max="40"
                            :gauge-color="[
                                { offset: 30, color: '#2FA325' },
                                { offset: 60, color: '#F0A815' },
                                { offset: 100, color: '#BC1E58' },
                            ]"                            
                            :scale-interval="1">
                            <div class="inner-text">
                                <p>{{ device.json.now_temperature }}°C</p>
                            </div>
                            </VueSvgGauge>
                        </div>
                        </div>
                    <div class="w-100"></div>
                    <div class="col bg-light fw-bold">습도</div>
                    <div class="col">{{ device.json.humidity }}%</div>
                    <div class="h-200"></div>
                    <div class="col bg-light fw-bold">희망온도</div>
                    <div class="col">
                        <!-- 희망온도 표시-->
                        <div style="height: 100px">
                            <VueSvgGauge class="h-100 d-inline-block"
                            :start-angle="-90"
                            :end-angle="90"
                            :value=device.json.hope_temperature
                            :separator-step="2"
                            :separator-thickness="2"
                            :min="10"
                            :max="40"
                            :gauge-color="[
                                { offset: 30, color: '#2FA325' },
                                { offset: 60, color: '#F0A815' },
                                { offset: 100, color: '#BC1E58' },
                            ]"                            
                            :scale-interval="1">
                            <div class="inner-text">
                                <p>{{ device.json.hope_temperature }}°C</p>
                            </div>
                            </VueSvgGauge>
                        </div>
                        
                        <!-- 희망온도 컨트롤 -->
                        <label class="form-label" for="customRange1">
                            <div class="input-group mb-3">
                            <input type="text" class="form-control someInput" aria-label="hope temperature" v-model="control.hope_temperature">
                            <span class="input-group-text">°C</span>
                        </div>
                        </label>
                            <div class="range">
                            <input type="range" v-model="control.hope_temperature" min="16" max="36" class="form-range" id="customRange1" list="tickmarks" @change="setControl('hope_temperature', $event)"/>
                            <datalist id="tickmarks">
                                <option value="14">14</option>
                                <option value="20">20</option>
                                <option value="24">24</option>
                                <option value="38">28</option>
                                <option value="32">32</option>
                                <option value="36">36</option>
                            </datalist>
                        </div>
                        
                     
                    </div>
                    <div class="w-100"></div>
                    <div class="col bg-light fw-bold"></div>
                    <div class="col"></div>
                    <div class="w-100"></div>
                    
                    <div class="col bg-light fw-bold">동작모드</div>
                    <div class="col">
                        <select class="form-select"  v-bind="control.mode" @change="setControl('mode', $event)">
                            <option value="1">난방</option>
                            <option value="2">절약</option>
                            <option value="3">샤워</option>
                            <option value="4">온돌</option>
                            <option value="5">외출</option>
                            <option value="6">고온</option>
                        </select>
                        <template v-if="device.json.mode == 1" >
                            <img src="@/assets/images/general.png" class="img-thumbnail"/>
                        </template>
                        <template v-if="device.json.mode == 2" >
                            <img src="@/assets/images/save.png" class="img-thumbnail"/>
                        </template>
                        <template v-if="device.json.mode == 3" >
                            <img src="@/assets/images/shower.png" class="img-thumbnail"/>
                        </template>
                        <template v-if="device.json.mode == 4" >
                            <img src="@/assets/images/ondol.jpg" class="img-thumbnail"/>
                        </template>
                        <template v-if="device.json.mode == 5" >
                            <img src="@/assets/images/out.png" class="img-thumbnail" />
                        </template>
                        <template v-if="device.json.mode == 6" >
                            <img src="@/assets/images/hotwater.png" class="img-thumbnail"/>
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

export default {
    data() {
        return {
            device: {json :{hope_temperature : 0}},
            control : {
                switch: 0, mode : 1 , hope_temperature: 25
            }
            ,
            
        };
    },
    created() {},
    methods : {
      checkArr : function() {
        console.log(this.control);
      },
      getStatus : function(){
        this.$http
            .get('/api/iot/status/1000')
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
        let deviceControl =  event.target.value;
        //switch event handler
        if(col === "switch"){
            deviceControl = event.target.checked ? 1 : 0
        }else if(col === "hope_temperature"){
            deviceControl = this.control.hope_temperature
        }
        console.log(deviceControl, col)
        const json = JSON.stringify({ deviceControl: deviceControl, deviceControlName : col});
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
    },
    
}
</script>
