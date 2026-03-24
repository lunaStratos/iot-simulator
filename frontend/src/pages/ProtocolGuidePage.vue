<template>
  <div>
    <n-h2 style="margin-bottom: 4px;">Protocol Guide</n-h2>
    <n-text depth="3">각 프로토콜별 직접 접속 방법 안내</n-text>

    <n-tabs type="card" animated style="margin-top: 20px;" default-value="http">
      <!-- HTTP -->
      <n-tab-pane name="http" tab="HTTP (REST)">
        <n-card>
          <n-descriptions label-placement="left" :column="1" bordered size="small" style="margin-bottom: 16px;">
            <n-descriptions-item label="포트">3000</n-descriptions-item>
            <n-descriptions-item label="프로토콜">HTTP/1.1 REST</n-descriptions-item>
            <n-descriptions-item label="도구">curl, Postman, 브라우저</n-descriptions-item>
          </n-descriptions>

          <n-h4>상태 조회</n-h4>
          <n-code :code="httpStatus" language="bash" word-wrap />

          <n-h4 style="margin-top: 16px;">디바이스 제어</n-h4>
          <n-code :code="httpControl" language="bash" word-wrap />

          <n-h4 style="margin-top: 16px;">프로토콜 경유 조회</n-h4>
          <n-text depth="3" style="font-size: 13px; display: block; margin-bottom: 8px;">
            HTTP API에 ?protocol= 파라미터를 추가하면 백엔드가 해당 프로토콜 서버를 경유하여 통신합니다.
          </n-text>
          <n-code :code="httpProxy" language="bash" word-wrap />
        </n-card>
      </n-tab-pane>

      <!-- MQTT -->
      <n-tab-pane name="mqtt" tab="MQTT">
        <n-card>
          <n-descriptions label-placement="left" :column="1" bordered size="small" style="margin-bottom: 16px;">
            <n-descriptions-item label="포트">1883</n-descriptions-item>
            <n-descriptions-item label="프로토콜">MQTT v3.1.1</n-descriptions-item>
            <n-descriptions-item label="도구">mosquitto_pub/sub, MQTT Explorer</n-descriptions-item>
            <n-descriptions-item label="필수사항">
              <n-tag type="warning" size="small" :bordered="false">MQTT 브로커(mosquitto 등) 필요</n-tag>
            </n-descriptions-item>
          </n-descriptions>

          <n-h4>상태 구독</n-h4>
          <n-text depth="3" style="font-size: 13px; display: block; margin-bottom: 8px;">3초마다 자동 발행됩니다.</n-text>
          <n-code :code="mqttSubscribe" language="bash" word-wrap />

          <n-h4 style="margin-top: 16px;">디바이스 제어</n-h4>
          <n-code :code="mqttControl" language="bash" word-wrap />

          <n-h4 style="margin-top: 16px;">Topic 구조</n-h4>
          <n-table :bordered="true" :single-line="false" size="small">
            <thead><tr><th>Topic</th><th>설명</th></tr></thead>
            <tbody>
              <tr><td><n-tag size="tiny">iot/status/1000</n-tag></td><td>보일러 상태 (pub)</td></tr>
              <tr><td><n-tag size="tiny">iot/status/2000</n-tag></td><td>스마트 LED 상태 (pub)</td></tr>
              <tr><td><n-tag size="tiny">iot/control</n-tag></td><td>디바이스 제어 (sub)</td></tr>
            </tbody>
          </n-table>
        </n-card>
      </n-tab-pane>

      <!-- CoAP -->
      <n-tab-pane name="coap" tab="CoAP">
        <n-card>
          <n-descriptions label-placement="left" :column="1" bordered size="small" style="margin-bottom: 16px;">
            <n-descriptions-item label="포트">5683</n-descriptions-item>
            <n-descriptions-item label="프로토콜">CoAP (RFC 7252)</n-descriptions-item>
            <n-descriptions-item label="도구">coap-cli, libcoap</n-descriptions-item>
          </n-descriptions>

          <n-h4>설치</n-h4>
          <n-code code="npm install -g coap-cli" language="bash" word-wrap />

          <n-h4 style="margin-top: 16px;">상태 조회</n-h4>
          <n-code :code="coapStatus" language="bash" word-wrap />

          <n-h4 style="margin-top: 16px;">디바이스 제어</n-h4>
          <n-code :code="coapControl" language="bash" word-wrap />
        </n-card>
      </n-tab-pane>

      <!-- BACnet -->
      <n-tab-pane name="bacnet" tab="BACnet">
        <n-card>
          <n-descriptions label-placement="left" :column="1" bordered size="small" style="margin-bottom: 16px;">
            <n-descriptions-item label="포트">47808 (표준)</n-descriptions-item>
            <n-descriptions-item label="라이브러리">node-bacnet</n-descriptions-item>
            <n-descriptions-item label="도구">node-bacnet, BACnet Explorer</n-descriptions-item>
          </n-descriptions>

          <n-h4>오브젝트 매핑</n-h4>
          <n-table :bordered="true" :single-line="false" size="small">
            <thead><tr><th>디바이스</th><th>속성</th><th>Object Type</th><th>Instance</th></tr></thead>
            <tbody>
              <tr v-for="row in bacnetMap" :key="row.prop + row.instance">
                <td>{{ row.device }}</td>
                <td><n-tag size="tiny">{{ row.prop }}</n-tag></td>
                <td>{{ row.type }}</td>
                <td>{{ row.instance }}</td>
              </tr>
            </tbody>
          </n-table>

          <n-h4 style="margin-top: 16px;">Node.js 예제</n-h4>
          <n-code :code="bacnetCode" language="javascript" word-wrap />
        </n-card>
      </n-tab-pane>

      <!-- OPC-UA -->
      <n-tab-pane name="opcua" tab="OPC-UA">
        <n-card>
          <n-descriptions label-placement="left" :column="1" bordered size="small" style="margin-bottom: 16px;">
            <n-descriptions-item label="포트">4840</n-descriptions-item>
            <n-descriptions-item label="엔드포인트">
              <n-tag size="small" :bordered="false" type="info">opc.tcp://localhost:4840/UA/IoTSimulator</n-tag>
            </n-descriptions-item>
            <n-descriptions-item label="라이브러리">node-opcua</n-descriptions-item>
            <n-descriptions-item label="도구">UaExpert, Prosys OPC UA Browser</n-descriptions-item>
          </n-descriptions>

          <n-h4>노드 구조</n-h4>
          <n-code :code="opcuaTree" language="text" word-wrap />

          <n-h4 style="margin-top: 16px;">Node.js 예제</n-h4>
          <n-code :code="opcuaCode" language="javascript" word-wrap />
        </n-card>
      </n-tab-pane>

      <!-- Modbus -->
      <n-tab-pane name="modbus" tab="Modbus TCP">
        <n-card>
          <n-descriptions label-placement="left" :column="1" bordered size="small" style="margin-bottom: 16px;">
            <n-descriptions-item label="포트">5020</n-descriptions-item>
            <n-descriptions-item label="프로토콜">Modbus TCP</n-descriptions-item>
            <n-descriptions-item label="지원 FC">FC03 (Read), FC06 (Write Single)</n-descriptions-item>
            <n-descriptions-item label="도구">modpoll, QModMaster, modbus-serial</n-descriptions-item>
          </n-descriptions>

          <n-h4>레지스터 매핑</n-h4>
          <n-table :bordered="true" :single-line="false" size="small">
            <thead><tr><th>주소</th><th>디바이스</th><th>속성</th></tr></thead>
            <tbody>
              <tr v-for="row in modbusMap" :key="row.addr">
                <td><n-tag size="tiny" type="info">{{ row.addr }}</n-tag></td>
                <td>{{ row.device }}</td>
                <td>{{ row.prop }}</td>
              </tr>
            </tbody>
          </n-table>

          <n-h4 style="margin-top: 16px;">modpoll 예제</n-h4>
          <n-code :code="modbusModpoll" language="bash" word-wrap />

          <n-h4 style="margin-top: 16px;">Node.js 예제</n-h4>
          <n-code :code="modbusCode" language="javascript" word-wrap />
        </n-card>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup>
// ── HTTP ──
const httpStatus = `# 보일러 상태 조회
curl http://localhost:3000/api/iot/status/1000

# 스마트 LED 상태 조회
curl http://localhost:3000/api/iot/status/2000`

const httpControl = `# 보일러 전원 ON
curl -X PUT http://localhost:3000/api/iot/control/1000 \\
  -H "Content-Type: application/json" \\
  -d '{"deviceControl": 1, "deviceControlName": "switch"}'

# 보일러 희망온도 25도
curl -X PUT http://localhost:3000/api/iot/control/1000 \\
  -H "Content-Type: application/json" \\
  -d '{"deviceControl": 25, "deviceControlName": "hope_temperature"}'

# 스마트 LED 밝기 80
curl -X PUT http://localhost:3000/api/iot/control/2000 \\
  -H "Content-Type: application/json" \\
  -d '{"deviceControl": 80, "deviceControlName": "strength"}'`

const httpProxy = `# 각 프로토콜 서버를 경유하여 조회
curl http://localhost:3000/api/iot/status/1000?protocol=mqtt
curl http://localhost:3000/api/iot/status/1000?protocol=coap
curl http://localhost:3000/api/iot/status/1000?protocol=bacnet
curl http://localhost:3000/api/iot/status/1000?protocol=opcua
curl http://localhost:3000/api/iot/status/1000?protocol=modbus`

// ── MQTT ──
const mqttSubscribe = `# 보일러 상태 구독 (3초 간격 자동 발행)
mosquitto_sub -h localhost -p 1883 -t "iot/status/1000"

# 스마트 LED 상태 구독
mosquitto_sub -h localhost -p 1883 -t "iot/status/2000"`

const mqttControl = `# 보일러 전원 OFF
mosquitto_pub -h localhost -p 1883 -t "iot/control" \\
  -m '{"deviceId":"1000","deviceControl":"0","deviceControlName":"switch"}'

# 보일러 희망온도 28도
mosquitto_pub -h localhost -p 1883 -t "iot/control" \\
  -m '{"deviceId":"1000","deviceControl":"28","deviceControlName":"hope_temperature"}'

# 스마트 LED 밝기 50
mosquitto_pub -h localhost -p 1883 -t "iot/control" \\
  -m '{"deviceId":"2000","deviceControl":"50","deviceControlName":"strength"}'`

// ── CoAP ──
const coapStatus = `# 보일러 상태
coap get coap://localhost:5683/iot/status/1000

# 스마트 LED 상태
coap get coap://localhost:5683/iot/status/2000`

const coapControl = `# 보일러 전원 ON
echo '{"deviceControl":1,"deviceControlName":"switch"}' | \\
  coap put coap://localhost:5683/iot/control/1000

# 스마트 LED 모드 변경
echo '{"deviceControl":3,"deviceControlName":"mode"}' | \\
  coap put coap://localhost:5683/iot/control/2000`

// ── BACnet ──
const bacnetMap = [
  { device: '보일러(1000)', prop: 'hope_temperature', type: 'Analog Value (2)', instance: 1 },
  { device: '보일러(1000)', prop: 'now_temperature', type: 'Analog Value (2)', instance: 2 },
  { device: '보일러(1000)', prop: 'humidity', type: 'Analog Value (2)', instance: 3 },
  { device: '보일러(1000)', prop: 'mode', type: 'Analog Value (2)', instance: 4 },
  { device: '보일러(1000)', prop: 'switch', type: 'Binary Value (5)', instance: 1 },
  { device: '스마트LED(2000)', prop: 'strength', type: 'Analog Value (2)', instance: 10 },
  { device: '스마트LED(2000)', prop: 'mode', type: 'Analog Value (2)', instance: 11 },
  { device: '스마트LED(2000)', prop: 'switch', type: 'Binary Value (5)', instance: 10 }
]

const bacnetCode = `const bacnet = require('node-bacnet');
const client = new bacnet();

// ReadProperty — 보일러 희망온도 읽기
client.readProperty('localhost',
  { type: 2, instance: 1 }, 85,
  (err, value) => {
    console.log('hope_temperature:', value.values[0].value);
  }
);

// WriteProperty — 보일러 희망온도 25도 설정
client.writeProperty('localhost',
  { type: 2, instance: 1 }, 85,
  [{ type: 7, value: '25' }],
  (err) => console.log(err ? 'error' : 'ok')
);`

// ── OPC-UA ──
const opcuaTree = `Objects/
  └─ IoTDevices/
       ├─ Boiler_1000/
       │    ├─ hope_temperature  (ns=1;s=1000_hope_temperature)
       │    ├─ now_temperature   (ns=1;s=1000_now_temperature)
       │    ├─ humidity          (ns=1;s=1000_humidity)
       │    ├─ mode              (ns=1;s=1000_mode)
       │    ├─ switch            (ns=1;s=1000_switch)
       │    └─ status            (ns=1;s=1000_status)
       └─ SmartSwitch_2000/
            ├─ switch            (ns=1;s=2000_switch)
            ├─ color             (ns=1;s=2000_color)
            ├─ strength          (ns=1;s=2000_strength)
            ├─ mode              (ns=1;s=2000_mode)
            └─ status            (ns=1;s=2000_status)`

const opcuaCode = `const opcua = require('node-opcua');

async function main() {
  const client = opcua.OPCUAClient.create({
    endpointMustExist: false
  });
  await client.connect(
    'opc.tcp://localhost:4840/UA/IoTSimulator'
  );
  const session = await client.createSession();

  // 읽기 — 보일러 희망온도
  const result = await session.read({
    nodeId: 'ns=1;s=1000_hope_temperature'
  });
  console.log('hope_temperature:', result.value.value);

  // 쓰기 — 보일러 희망온도 28도
  await session.write({
    nodeId: 'ns=1;s=1000_hope_temperature',
    attributeId: opcua.AttributeIds.Value,
    value: {
      value: new opcua.Variant({
        dataType: opcua.DataType.String,
        value: '28'
      })
    }
  });

  await session.close();
  await client.disconnect();
}
main();`

// ── Modbus ──
const modbusMap = [
  { addr: 0, device: '보일러(1000)', prop: 'hope_temperature' },
  { addr: 1, device: '보일러(1000)', prop: 'now_temperature' },
  { addr: 2, device: '보일러(1000)', prop: 'humidity' },
  { addr: 3, device: '보일러(1000)', prop: 'mode' },
  { addr: 4, device: '보일러(1000)', prop: 'switch' },
  { addr: 100, device: '스마트LED(2000)', prop: 'switch' },
  { addr: 101, device: '스마트LED(2000)', prop: 'strength' },
  { addr: 102, device: '스마트LED(2000)', prop: 'mode' }
]

const modbusModpoll = `# 보일러 레지스터 5개 읽기 (주소 0~4)
modpoll -m tcp -p 5020 -r 1 -c 5 localhost

# 보일러 희망온도를 25로 설정 (레지스터 0)
modpoll -m tcp -p 5020 -r 1 -c 1 localhost 25

# 스마트 LED switch ON (레지스터 100)
modpoll -m tcp -p 5020 -r 101 -c 1 localhost 1`

const modbusCode = `const ModbusRTU = require('modbus-serial');
const client = new ModbusRTU();

client.connectTCP('localhost', { port: 5020 }, () => {
  client.setID(1);

  // 읽기 — 보일러 희망온도 (레지스터 0)
  client.readHoldingRegisters(0, 1, (err, data) => {
    console.log('hope_temperature:', data.data[0]);
  });

  // 쓰기 — 보일러 희망온도 25로 설정
  client.writeRegister(0, 25, (err) => {
    console.log(err ? 'error' : 'ok');
  });
});`
</script>
