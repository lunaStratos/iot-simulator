/**
 * Matter 브리지 노드 — matter.js (@matter/main)
 *
 * Aggregator(브리지) 아래에 보일러(Thermostat), 스마트 LED(Extended Color Light),
 * 온도계(Temperature Sensor)를 브리지드 엔드포인트로 등록한다.
 * Apple 홈 / Google Home / Home Assistant 등 Matter 컨트롤러에서 페어링 코드로 커미셔닝할 수 있다.
 *
 * Matter 는 커미셔닝(패브릭 가입) 없이는 외부에서 읽고 쓸 수 없으므로,
 * protocol-client 는 이 모듈의 readStatus / writeControl 로 엔드포인트 상태(Matter 데이터 모델)에 직접 접근한다.
 */
const path = require('path');
const { Endpoint, Environment, ServerNode, VendorId, Logger } = require('@matter/main');
const { AggregatorEndpoint } = require('@matter/main/endpoints/aggregator');
const { BridgedDeviceBasicInformationServer } = require('@matter/main/behaviors/bridged-device-basic-information');
const { ThermostatServer } = require('@matter/main/behaviors/thermostat');
const { RelativeHumidityMeasurementServer } = require('@matter/main/behaviors/relative-humidity-measurement');
const { ModeSelectServer } = require('@matter/main/behaviors/mode-select');
const { ColorControlServer } = require('@matter/main/behaviors/color-control');
const { ThermostatDevice } = require('@matter/main/devices/thermostat');
const { ExtendedColorLightDevice } = require('@matter/main/devices/extended-color-light');
const { TemperatureSensorDevice } = require('@matter/main/devices/temperature-sensor');
const storage = require('../config/storage');
const { hexToHs, hsToHex } = require('../util/color');

const portNumber = Number(process.env.MATTER_PORT) || 5541;
const PASSCODE = Number(process.env.MATTER_PASSCODE) || 20202022;
const DISCRIMINATOR = Number(process.env.MATTER_DISCRIMINATOR) || 3850;

// Thermostat SystemMode
const SYSTEM_MODE_OFF = 0;
const SYSTEM_MODE_HEAT = 4;

// ─── 값 변환 ───────────────────────────────────────────
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const num = (v) => Number(v) || 0;
const onOff = (v) => !!(v && v !== '0');
// 0.01 단위 정수 (온도 ℃, 습도 %)
const toCenti = (min, max) => (v) => clamp(Math.round(num(v) * 100), min, max);
const fromCenti = (v) => String(v / 100);

// 밝기 0~100 ↔ LevelControl 1~254
const toLevel = (v) => clamp(Math.round(num(v) * 254 / 100), 1, 254);
const fromLevel = (v) => String(Math.round(v * 100 / 254));

// 색상 HEX ↔ ColorControl Hue/Saturation (0~254)
const toMatterHs = (hex) => {
  const { hue, saturation } = hexToHs(hex);
  return { currentHue: Math.round(hue * 254 / 360), currentSaturation: Math.round(saturation * 254 / 100) };
};
const fromMatterHs = ({ currentHue, currentSaturation }) => hsToHex(currentHue * 360 / 254, currentSaturation * 100 / 254);

const modeOptions = (labels) => labels.map((label, i) => ({ label, mode: i + 1, semanticTags: [] }));

/**
 * 디바이스별 속성 매핑
 *  prop        — 스토리지 속성
 *  cluster     — 엔드포인트 state 의 클러스터 키
 *  attrs       — 변경을 감지할 속성 (대부분 1개, color 는 hue/saturation 2개)
 *  toMatter    — 스토리지 값 → 클러스터 state patch
 *  fromMatter  — 클러스터 state → 스토리지 값
 */
const deviceDefs = [
  {
    deviceId: 1000, id: 'boiler-1000',
    type: ThermostatDevice.with(
      BridgedDeviceBasicInformationServer,
      ThermostatServer.with('Heating'),
      RelativeHumidityMeasurementServer,
      ModeSelectServer
    ),
    initial: {
      thermostat: {
        controlSequenceOfOperation: 2, // HeatingOnly
        absMinHeatSetpointLimit: 1600, absMaxHeatSetpointLimit: 3600,
        minHeatSetpointLimit: 1600, maxHeatSetpointLimit: 3600
      },
      relativeHumidityMeasurement: { minMeasuredValue: 0, maxMeasuredValue: 10000 },
      modeSelect: {
        description: 'Boiler Mode', standardNamespace: null,
        supportedModes: modeOptions(['Heating', 'Eco', 'Shower', 'Ondol', 'Away', 'High Temp'])
      }
    },
    props: [
      { prop: 'switch', cluster: 'thermostat', attrs: ['systemMode'],
        toMatter: (v) => ({ systemMode: onOff(v) ? SYSTEM_MODE_HEAT : SYSTEM_MODE_OFF }),
        fromMatter: (s) => (s.systemMode === SYSTEM_MODE_OFF ? '0' : '1') },
      { prop: 'hope_temperature', cluster: 'thermostat', attrs: ['occupiedHeatingSetpoint'],
        toMatter: (v) => ({ occupiedHeatingSetpoint: toCenti(1600, 3600)(v) }),
        fromMatter: (s) => fromCenti(s.occupiedHeatingSetpoint) },
      { prop: 'now_temperature', cluster: 'thermostat', attrs: ['localTemperature'],
        toMatter: (v) => ({ localTemperature: toCenti(-27315, 32767)(v) }),
        fromMatter: (s) => fromCenti(s.localTemperature) },
      { prop: 'humidity', cluster: 'relativeHumidityMeasurement', attrs: ['measuredValue'],
        toMatter: (v) => ({ measuredValue: toCenti(0, 10000)(v) }),
        fromMatter: (s) => fromCenti(s.measuredValue) },
      { prop: 'mode', cluster: 'modeSelect', attrs: ['currentMode'],
        toMatter: (v) => ({ currentMode: clamp(Math.round(num(v)), 1, 6) }),
        fromMatter: (s) => String(s.currentMode) }
    ]
  },
  {
    deviceId: 2000, id: 'led-2000',
    type: ExtendedColorLightDevice.with(
      BridgedDeviceBasicInformationServer,
      ColorControlServer.with('HueSaturation', 'Xy', 'ColorTemperature'),
      ModeSelectServer
    ),
    initial: {
      colorControl: {
        colorMode: 0, // CurrentHueAndCurrentSaturation
        remainingTime: 0,
        colorTempPhysicalMinMireds: 147, colorTempPhysicalMaxMireds: 500,
        coupleColorTempToLevelMinMireds: 147,
        colorTemperatureMireds: 250, startUpColorTemperatureMireds: 250
      },
      modeSelect: {
        description: 'LED Mode', standardNamespace: null,
        supportedModes: modeOptions(['Normal', 'Soft', 'Blink', 'Santa'])
      }
    },
    props: [
      { prop: 'switch', cluster: 'onOff', attrs: ['onOff'],
        toMatter: (v) => ({ onOff: onOff(v) }),
        fromMatter: (s) => (s.onOff ? '1' : '0') },
      { prop: 'strength', cluster: 'levelControl', attrs: ['currentLevel'],
        toMatter: (v) => ({ currentLevel: toLevel(v) }),
        fromMatter: (s) => fromLevel(s.currentLevel) },
      { prop: 'color', cluster: 'colorControl', attrs: ['currentHue', 'currentSaturation'],
        toMatter: (v) => ({ colorMode: 0, ...toMatterHs(v) }),
        fromMatter: (s) => fromMatterHs(s) },
      { prop: 'mode', cluster: 'modeSelect', attrs: ['currentMode'],
        toMatter: (v) => ({ currentMode: clamp(Math.round(num(v)), 1, 4) }),
        fromMatter: (s) => String(s.currentMode) }
    ]
  },
  {
    deviceId: 3000, id: 'thermometer-3000',
    type: TemperatureSensorDevice.with(BridgedDeviceBasicInformationServer),
    initial: {
      temperatureMeasurement: { minMeasuredValue: -2000, maxMeasuredValue: 5000 }
    },
    props: [
      { prop: 'temperature', cluster: 'temperatureMeasurement', attrs: ['measuredValue'],
        toMatter: (v) => ({ measuredValue: toCenti(-2000, 5000)(v) }),
        fromMatter: (s) => fromCenti(s.measuredValue) }
    ]
  }
];

// deviceId → { def, endpoint, syncing, lastSynced: { prop: storageValue }, queue }
const nodes = {};

let server = null;

// 스토리지 값으로 클러스터 state patch 생성 (onlyChanged: 마지막 동기화 이후 바뀐 prop 만)
function buildPatch(node, onlyChanged) {
  const patch = {};
  node.def.props.forEach((p) => {
    const value = storage.getValue(node.def.deviceId, p.prop);
    if (value === null) return;
    if (onlyChanged && node.lastSynced[p.prop] === value) return;
    node.lastSynced[p.prop] = value;
    patch[p.cluster] = { ...patch[p.cluster], ...p.toMatter(value) };
  });
  return patch;
}

// 엔드포인트 쓰기를 디바이스 단위로 직렬화 — 스토리지 동기화 중 발생한 이벤트는 역반영하지 않음
function applyPatch(node, patch, fromStorage) {
  if (Object.keys(patch).length === 0) return Promise.resolve();
  node.queue = node.queue.then(async () => {
    node.syncing = fromStorage;
    try {
      await node.endpoint.set(patch);
    } finally {
      node.syncing = false;
    }
  });
  return node.queue;
}

// 스토리지 변경 → Matter 엔드포인트
function syncFromStorage(deviceId) {
  const node = nodes[deviceId];
  if (!node) return;
  applyPatch(node, buildPatch(node, true), true)
    .catch((err) => console.error('[Matter] Sync failed — deviceId=%s error=%s', deviceId, err.message));
}

// Matter 컨트롤러 쓰기 → 스토리지
function watchEndpoint(node) {
  const { def, endpoint } = node;
  def.props.forEach((p) => {
    p.attrs.forEach((attr) => {
      endpoint.events[p.cluster][`${attr}$Changed`].on(() => {
        if (node.syncing) return;
        const value = p.fromMatter(endpoint.state[p.cluster]);
        if (value === storage.getValue(def.deviceId, p.prop)) return;
        console.log('[Matter] Write — deviceId=%d %s=%s', def.deviceId, p.prop, value);
        node.lastSynced[p.prop] = value;
        storage.setValue(def.deviceId, p.prop, value);
      });
    });
  });
}

function getNode(deviceId) {
  const node = nodes[Number(deviceId)];
  if (!node) throw new Error('Unknown Matter device');
  return node;
}

module.exports = {

  portNumber,
  PASSCODE,
  DISCRIMINATOR,

  deviceDefs,

  /** 커미셔닝 정보 — 서버 미기동 시 null */
  pairingInfo() {
    if (!server) return null;
    const { commissioned, pairingCodes } = server.state.commissioning;
    return {
      passcode: PASSCODE,
      discriminator: DISCRIMINATOR,
      manualPairingCode: pairingCodes.manualPairingCode,
      qrPairingCode: pairingCodes.qrPairingCode,
      commissioned
    };
  },

  async connect() {
    try {
      Logger.level = process.env.MATTER_LOG_LEVEL || 'notice';
      if (!process.env.MATTER_STORAGE_PATH) {
        Environment.default.vars.set('storage.path', path.join(__dirname, '../data/matter'));
      }

      const created = await ServerNode.create({
        id: 'iot-simulator',
        network: { port: portNumber },
        commissioning: { passcode: PASSCODE, discriminator: DISCRIMINATOR },
        productDescription: { name: 'IoT Simulator', deviceType: AggregatorEndpoint.deviceType },
        basicInformation: {
          vendorName: 'IoT Simulator',
          vendorId: VendorId(0xfff1), // 테스트용 Vendor ID
          productId: 0x8000,
          productName: 'Virtual Bridge',
          nodeLabel: storage.SIMULATOR_NAME,
          hardwareVersion: 1,
          softwareVersion: 1,
          serialNumber: 'IOTSIM-BRIDGE',
          uniqueId: 'iot-simulator-matter-bridge'
        }
      });

      const aggregator = new Endpoint(AggregatorEndpoint, { id: 'aggregator' });
      await created.add(aggregator);

      for (const def of deviceDefs) {
        const device = storage.getDevice(def.deviceId) || {};
        const displayName = storage.getDisplayName(def.deviceId);
        const node = { def, syncing: false, lastSynced: {}, queue: Promise.resolve() };
        const initialState = buildPatch(node, false);
        for (const [cluster, values] of Object.entries(def.initial)) {
          initialState[cluster] = { ...values, ...initialState[cluster] };
        }

        node.endpoint = new Endpoint(def.type, {
          id: def.id,
          bridgedDeviceBasicInformation: {
            nodeLabel: displayName,
            productName: displayName,
            serialNumber: 'IOTSIM-' + def.deviceId,
            softwareVersionString: device.firmware || '1.0.0',
            reachable: true
          },
          ...initialState
        });
        await aggregator.add(node.endpoint);

        // 저장소(data/matter)에 남은 이전 상태보다 현재 스토리지 값 / 표시 이름을 우선
        await node.endpoint.set({ bridgedDeviceBasicInformation: { nodeLabel: displayName, productName: displayName } });
        node.lastSynced = {};
        await applyPatch(node, buildPatch(node, false), true);

        watchEndpoint(node);
        nodes[def.deviceId] = node;
      }

      storage.events.on('change', ({ deviceId }) => syncFromStorage(Number(deviceId)));

      await created.start();
      server = created;
      console.info('[Matter] Server started — port=%d passcode=%d discriminator=%d manualCode=%s',
        portNumber, PASSCODE, DISCRIMINATOR, server.state.commissioning.pairingCodes.manualPairingCode);
    } catch (err) {
      if (err.code === 'EADDRINUSE' || /EADDRINUSE|already in use/.test(err.message)) {
        console.error('[Matter] Port %d already in use — skipping', portNumber);
      } else {
        console.error('[Matter] Server start failed — %s', err.message);
      }
    }
  },

  /**
   * 디바이스 상태 조회 — Matter 클러스터 state 를 스토리지 형식으로 변환
   */
  async readStatus(deviceId) {
    const { def, endpoint } = getNode(deviceId);
    const json = {};
    def.props.forEach((p) => {
      json[p.prop] = p.fromMatter(endpoint.state[p.cluster]);
    });
    return { device: { id: def.deviceId, json }, protocol: 'matter' };
  },

  /**
   * 디바이스 제어 — 클러스터 state 에 쓰면 변경 이벤트가 스토리지로 반영됨
   */
  async writeControl(deviceId, controlName, controlValue) {
    const node = getNode(deviceId);
    const p = node.def.props.find((x) => x.prop === controlName);
    if (!p) throw new Error('Unknown Matter attribute');
    await applyPatch(node, { [p.cluster]: p.toMatter(String(controlValue)) }, false);
    return { status: 'ok' };
  }

};
