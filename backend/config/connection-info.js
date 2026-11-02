/**
 * 프로토콜별 접속 정보 — 프론트엔드 프로토콜 선택기에 표시
 *
 * 각 프로토콜 모듈이 export 하는 포트 / 포인트 매핑을 그대로 사용하므로
 * 매핑이 바뀌어도 화면 정보가 자동으로 맞춰진다.
 */
const os = require('os');
const storage = require('./storage');
const bacnetHandler = require('../conn/bacnet-device');
const modbusHandler = require('../conn/modbus-device');
const dnp3Handler = require('../conn/dnp3-device');
const iec61850Handler = require('../conn/iec61850-device');
const homekitHandler = require('../conn/homekit-device');
const matterHandler = require('../conn/matter-device');

const MQTT_PORT = 1883;
const COAP_PORT = 5683;
const OPCUA_PORT = 4840;
const OPCUA_PATH = '/UA/IoTSimulator';

// 외부 클라이언트가 접속할 LAN IPv4 (없으면 localhost)
function lanAddress() {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) return a.address;
    }
  }
  return 'localhost';
}

const BACNET_TYPE_LABEL = { 2: 'AV', 5: 'BV' };

function points(deviceId) {
  const id = Number(deviceId);
  const byDevice = (map, fmt) => Object.entries(map)
    .filter(([, m]) => m.deviceId === id)
    .map(([addr, m]) => ({ prop: m.name, address: fmt(addr, m) }));

  return {
    opcua: Object.keys(storage.getValues(id) || {}).map((prop) => ({ prop, address: `ns=1;s=${id}_${prop}` })),
    bacnet: Object.entries(bacnetHandler.deviceObjectMap[id] || {}).map(([prop, o]) =>
      ({ prop, address: `${BACNET_TYPE_LABEL[o.type] || o.type}:${o.instance}` })),
    modbus: byDevice(modbusHandler.registerMap, (addr, m) => `HR ${addr}` + (m.scale ? ` (×${m.scale})` : '')),
    dnp3: [
      ...byDevice(dnp3Handler.analogInputMap, (idx) => `AI(G30) ${idx}`),
      ...byDevice(dnp3Handler.binaryInputMap, (idx) => `BI(G1) ${idx}`)
    ],
    iec61850: byDevice(iec61850Handler.pathMap, (path) => path),
    homekit: ((homekitHandler.deviceDefs.find((d) => d.deviceId === id) || {}).chars || [])
      .filter((c) => !c.mirror)
      .map((c) => ({ prop: c.prop, address: new c.type().displayName })),
    matter: ((matterHandler.deviceDefs.find((d) => d.deviceId === id) || {}).props || [])
      .map((p) => ({ prop: p.prop, address: p.attrs.map((a) => `${p.cluster}.${a}`).join(' / ') }))
  };
}

/**
 * @param {string|number} deviceId
 * @param {number} httpPort — 실제 HTTP 서버 포트
 */
function build(deviceId, httpPort) {
  const host = lanAddress();
  const id = Number(deviceId) || 1000;
  const pts = points(id);
  const homekit = homekitHandler.pairingInfo();
  const matter = matterHandler.pairingInfo();
  const displayName = storage.getDisplayName(id);
  const nameRow = { label: '표시 이름', value: displayName };

  const protocols = [
    {
      id: 'http', name: 'HTTP (REST)', port: httpPort, transport: 'TCP',
      rows: [
        nameRow,
        { label: 'Base URL', value: `http://${host}:${httpPort}` },
        { label: '상태 조회', value: `GET /api/iot/status/${id}` },
        { label: '제어', value: `PUT /api/iot/control/${id}` },
        { label: '제어 Body', value: '{"deviceControlName":"<속성>","deviceControl":<값>}' }
      ]
    },
    {
      id: 'mqtt', name: 'MQTT', port: MQTT_PORT, transport: 'TCP',
      rows: [
        nameRow,
        { label: '브로커', value: `mqtt://${host}:${MQTT_PORT}` },
        { label: '상태 토픽', value: `iot/status/${id}` },
        { label: '제어 토픽', value: 'iot/control' },
        { label: '제어 Payload', value: `{"deviceId":"${id}","deviceControlName":"<속성>","deviceControl":"<값>"}` }
      ],
      notes: ['외부 MQTT 브로커(mosquitto 등)가 1883 포트에서 실행 중이어야 합니다.']
    },
    {
      id: 'coap', name: 'CoAP', port: COAP_PORT, transport: 'UDP',
      rows: [
        nameRow,
        { label: '상태 조회', value: `GET coap://${host}:${COAP_PORT}/iot/status/${id}` },
        { label: '제어', value: `PUT coap://${host}:${COAP_PORT}/iot/control/${id}` }
      ]
    },
    {
      id: 'bacnet', name: 'BACnet/IP', port: bacnetHandler.portNumber, transport: 'UDP',
      rows: [
        { label: '주소', value: `${host}:${bacnetHandler.portNumber}` },
        nameRow,
        { label: 'Device Object Name', value: bacnetHandler.DEVICE_NAME },
        { label: 'Device Instance', value: String(bacnetHandler.DEVICE_INSTANCE) },
        { label: '프로퍼티', value: 'Present_Value (85)' }
      ],
      notes: ['127.0.0.1 에서 보낸 요청은 무시되므로 LAN 주소로 접속하세요.'],
      points: pts.bacnet
    },
    {
      id: 'opcua', name: 'OPC-UA', port: OPCUA_PORT, transport: 'TCP',
      rows: [
        nameRow,
        { label: 'Endpoint', value: `opc.tcp://${host}:${OPCUA_PORT}${OPCUA_PATH}` },
        { label: 'Security', value: 'None / Anonymous' },
        { label: '데이터 타입', value: 'String' }
      ],
      points: pts.opcua
    },
    {
      id: 'modbus', name: 'Modbus TCP', port: modbusHandler.portNumber, transport: 'TCP',
      rows: [
        nameRow,
        { label: '주소', value: `${host}:${modbusHandler.portNumber}` },
        { label: 'Unit ID', value: '1 (모든 값 허용)' },
        { label: 'Function Code', value: 'FC03 읽기 / FC06 쓰기' }
      ],
      points: pts.modbus
    },
    {
      id: 'dnp3', name: 'DNP3', port: dnp3Handler.portNumber, transport: 'TCP',
      rows: [
        nameRow,
        { label: '주소', value: `${host}:${dnp3Handler.portNumber}` },
        { label: 'Outstation / Master', value: '10 / 1' },
        { label: 'Function Code', value: '0x01 Read / 0x03 Direct Operate' }
      ],
      notes: ['간소화된 DNP3 프레임입니다. 프레임 구조는 Protocol Guide 를 참고하세요.'],
      points: pts.dnp3
    },
    {
      id: 'iec61850', name: 'IEC 61850 (MMS)', port: iec61850Handler.portNumber, transport: 'TCP',
      rows: [
        nameRow,
        { label: '주소', value: `${host}:${iec61850Handler.portNumber}` },
        { label: '프레임', value: 'MMS\\0 + 길이(4B) + 서비스(1B: 0x01 Read, 0x02 Write) + JSON' }
      ],
      notes: ['간소화된 MMS 프레임입니다. 예제는 Protocol Guide 를 참고하세요.'],
      points: pts.iec61850
    },
    {
      id: 'homekit', name: 'HomeKit (HAP)', port: homekitHandler.portNumber, transport: 'TCP',
      rows: [
        { label: '브리지 이름', value: homekit ? homekit.bridgeName : storage.SIMULATOR_NAME },
        { label: '액세서리 이름', value: displayName },
        { label: '주소', value: `http://${host}:${homekitHandler.portNumber}` },
        { label: '페어링 PIN', value: homekitHandler.PINCODE },
        ...(homekit ? [
          { label: 'Setup URI', value: homekit.setupURI },
          { label: 'Bridge ID', value: homekit.username }
        ] : []),
        { label: '액세서리 Serial', value: homekitHandler.SERIAL_PREFIX + id }
      ],
      status: homekit
        ? { type: homekit.paired ? 'success' : 'warning', text: homekit.paired ? '페어링됨' : '페어링 대기' }
        : { type: 'error', text: '서버 미기동' },
      qr: homekit && !homekit.paired ? homekit.setupURI : null,
      notes: ['iPhone 홈 앱 → 액세서리 추가 → QR 스캔 또는 PIN 직접 입력'],
      points: pts.homekit
    },
    {
      id: 'matter', name: 'Matter', port: matterHandler.portNumber, transport: 'UDP',
      rows: [
        { label: '브리지 이름', value: storage.SIMULATOR_NAME },
        { label: '디바이스 이름', value: displayName },
        { label: '주소', value: `${host}:${matterHandler.portNumber} (mDNS 광고)` },
        ...(matter ? [
          { label: '수동 페어링 코드', value: matter.manualPairingCode },
          { label: 'QR Payload', value: matter.qrPairingCode }
        ] : []),
        { label: 'Passcode / Discriminator', value: `${matterHandler.PASSCODE} / ${matterHandler.DISCRIMINATOR}` }
      ],
      status: matter
        ? { type: matter.commissioned ? 'success' : 'warning', text: matter.commissioned ? '커미셔닝됨' : '커미셔닝 대기' }
        : { type: 'error', text: '서버 미기동' },
      qr: matter && !matter.commissioned ? matter.qrPairingCode : null,
      notes: ['테스트 Vendor ID(0xFFF1) — 컨트롤러에서 "인증되지 않은 기기" 경고 후 추가'],
      points: pts.matter
    }
  ];

  return { host, deviceId: id, protocols };
}

module.exports = { build };
