/**
 * HomeKit (HAP) 액세서리 서버 — hap-nodejs
 *
 * 브리지 1개에 보일러(Thermostat), 스마트 LED(Lightbulb), 온도계(TemperatureSensor)를
 * 브리지드 액세서리로 등록한다. iPhone 홈 앱에서 PIN 코드로 페어링할 수 있다.
 *
 * protocol-client 가 페어링 없이 HAP HTTP 로 직접 읽고 쓸 수 있도록 insecure 모드로 공개한다.
 * (GET 은 인증 없이, PUT 은 Authorization: <PIN> 헤더 필요 — 로컬 시뮬레이터 전용)
 */
const net = require('net');
const path = require('path');
const hap = require('hap-nodejs');
const storage = require('../config/storage');
const { HsColorState } = require('../util/color');

const { Bridge, Accessory, Service, Characteristic, Categories, Formats, Perms, HAPStorage, uuid } = hap;

const portNumber = Number(process.env.HOMEKIT_PORT) || 51827;
const PINCODE = process.env.HOMEKIT_PIN || '031-45-154';
const USERNAME = process.env.HOMEKIT_USERNAME || 'CC:22:3D:E3:CE:30';
const INSECURE = process.env.HOMEKIT_INSECURE !== 'false';

// 액세서리 식별용 시리얼 — protocol-client 가 /accessories 에서 디바이스를 찾을 때 사용
const SERIAL_PREFIX = 'IOTSIM-';

// ─── 커스텀 Characteristic (HAP 표준에 없는 mode / status) ───────────
class OperatingMode extends Characteristic {
  constructor() {
    super('Operating Mode', OperatingMode.UUID, {
      format: Formats.UINT8,
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY],
      minValue: 1, maxValue: 6, minStep: 1
    });
    this.value = this.getDefaultValue();
  }
}
OperatingMode.UUID = 'E8634C31-0001-4A0B-9D8E-3C1F5A7B2D01';

class DeviceStatus extends Characteristic {
  constructor() {
    super('Device Status', DeviceStatus.UUID, {
      format: Formats.STRING,
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
}
DeviceStatus.UUID = 'E8634C31-0002-4A0B-9D8E-3C1F5A7B2D01';

// ─── 값 변환 ───────────────────────────────────────────
const num = (v) => Number(v) || 0;
const onOff = (v) => (v && v !== '0' ? 1 : 0);
const toStr = (v) => String(v);

// 조명 색상 — Hue / Saturation 을 HEX 하나로 합치기 위한 디바이스별 상태
const colorStates = {};
function colorState(deviceId) {
  if (!colorStates[deviceId]) colorStates[deviceId] = new HsColorState(storage.getValue(deviceId, 'color'));
  return colorStates[deviceId];
}

/**
 * 디바이스별 Characteristic 매핑
 *  prop     — 스토리지 속성
 *  type     — HAP Characteristic
 *  toHap    — 스토리지 값 → HAP 값
 *  fromHap  — HAP 값 → 스토리지 값 (없으면 읽기 전용)
 *  mirror   — 같은 prop 을 표시만 하는 보조 Characteristic (클라이언트 조회 시 제외)
 *  part     — color 처럼 여러 Characteristic 을 합쳐 하나의 prop 을 만드는 경우
 */
const deviceDefs = [
  {
    deviceId: 1000, model: 'Virtual Boiler', service: Service.Thermostat,
    chars: [
      { prop: 'switch', type: Characteristic.TargetHeatingCoolingState, props: { validValues: [0, 1] }, toHap: onOff, fromHap: toStr },
      { prop: 'switch', type: Characteristic.CurrentHeatingCoolingState, props: { validValues: [0, 1] }, toHap: onOff, mirror: true },
      { prop: 'hope_temperature', type: Characteristic.TargetTemperature, props: { minValue: 16, maxValue: 36, minStep: 1 }, toHap: num, fromHap: toStr },
      { prop: 'now_temperature', type: Characteristic.CurrentTemperature, props: { minValue: -20, maxValue: 100 }, toHap: num },
      { prop: 'humidity', type: Characteristic.CurrentRelativeHumidity, toHap: num },
      { prop: 'mode', type: OperatingMode, props: { minValue: 1, maxValue: 6 }, toHap: num, fromHap: toStr },
      { prop: 'status', type: DeviceStatus, toHap: toStr, fromHap: toStr }
    ]
  },
  {
    deviceId: 2000, model: 'Virtual Smart LED', service: Service.Lightbulb,
    chars: [
      { prop: 'switch', type: Characteristic.On, toHap: (v) => onOff(v) === 1, fromHap: (v) => (v ? '1' : '0') },
      { prop: 'strength', type: Characteristic.Brightness, toHap: num, fromHap: toStr },
      { prop: 'color', part: 'hue', type: Characteristic.Hue,
        toHap: () => colorState(2000).hue, fromHap: (v) => colorState(2000).update({ hue: v }) },
      { prop: 'color', part: 'saturation', type: Characteristic.Saturation,
        toHap: () => colorState(2000).saturation, fromHap: (v) => colorState(2000).update({ saturation: v }) },
      { prop: 'mode', type: OperatingMode, props: { minValue: 1, maxValue: 4 }, toHap: num, fromHap: toStr },
      { prop: 'status', type: DeviceStatus, toHap: toStr, fromHap: toStr }
    ]
  },
  {
    deviceId: 3000, model: 'Virtual Thermometer', service: Service.TemperatureSensor,
    chars: [
      { prop: 'temperature', type: Characteristic.CurrentTemperature, props: { minValue: -20, maxValue: 50, minStep: 0.1 }, toHap: num },
      { prop: 'status', type: DeviceStatus, toHap: toStr, fromHap: toStr }
    ]
  }
];

// 스토리지 값 → HAP 값 (Characteristic 범위로 클램프)
function readHapValue(deviceId, def, props) {
  let value = def.toHap(storage.getValue(deviceId, def.prop) ?? '');
  const { minValue, maxValue } = props;
  if (typeof value === 'number') {
    if (minValue !== undefined) value = Math.max(minValue, value);
    if (maxValue !== undefined) value = Math.min(maxValue, value);
  }
  return value;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => probe.close(() => resolve(true)))
      .listen(port);
  });
}

// deviceId → [{ def, characteristic }]  (스토리지 변경 → HomeKit 알림용)
const bindings = {};

let bridge = null;
let published = false;

function buildAccessory({ deviceId, model, service, chars }) {
  const name = storage.getDisplayName(deviceId);
  const accessory = new Accessory(name, uuid.generate('iot-simulator:' + deviceId));
  const device = storage.getDevice(deviceId) || {};

  accessory.getService(Service.AccessoryInformation)
    .setCharacteristic(Characteristic.Manufacturer, 'IoT Simulator')
    .setCharacteristic(Characteristic.Model, model)
    .setCharacteristic(Characteristic.SerialNumber, SERIAL_PREFIX + deviceId)
    .setCharacteristic(Characteristic.FirmwareRevision, device.firmware || '1.0.0');

  const svc = accessory.addService(service, name);
  bindings[deviceId] = [];

  chars.forEach((def) => {
    const characteristic = svc.testCharacteristic(def.type)
      ? svc.getCharacteristic(def.type)
      : svc.addCharacteristic(def.type);
    // setProps 가 현재 값을 새 범위로 검증하므로 값을 먼저 맞춘 뒤 적용
    characteristic.value = readHapValue(deviceId, def, { ...characteristic.props, ...def.props });
    if (def.props) characteristic.setProps(def.props);

    characteristic.onGet(() => readHapValue(deviceId, def, characteristic.props));
    if (def.fromHap) {
      characteristic.onSet((value) => {
        const storageValue = def.fromHap(value);
        console.log('[HomeKit] Write — deviceId=%d %s=%s', deviceId, def.prop, storageValue);
        storage.setValue(deviceId, def.prop, storageValue);
      });
    }

    bindings[deviceId].push({ def, characteristic });
  });

  return accessory;
}

// 스토리지 변경 → HomeKit 컨트롤러에 이벤트 알림
function refresh(deviceId) {
  const list = bindings[deviceId];
  if (!list) return;
  if (colorStates[deviceId]) colorStates[deviceId].sync(storage.getValue(deviceId, 'color'));

  list.forEach(({ def, characteristic }) => {
    const value = readHapValue(deviceId, def, characteristic.props);
    if (characteristic.value !== value) characteristic.updateValue(value);
  });
}

module.exports = {

  PINCODE,
  SERIAL_PREFIX,
  portNumber,
  deviceDefs,

  /** 페어링 정보 — 서버 미기동 시 null */
  pairingInfo() {
    if (!published) return null;
    return {
      pincode: PINCODE,
      bridgeName: bridge.displayName,
      setupURI: bridge.setupURI(),
      username: USERNAME,
      paired: !!(bridge._accessoryInfo && bridge._accessoryInfo.paired())
    };
  },

  async connect() {
    HAPStorage.setCustomStoragePath(path.join(__dirname, '../data/homekit'));

    bridge = new Bridge(storage.SIMULATOR_NAME, uuid.generate('iot-simulator:bridge'));
    bridge.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, 'IoT Simulator')
      .setCharacteristic(Characteristic.Model, 'Virtual Bridge')
      .setCharacteristic(Characteristic.SerialNumber, SERIAL_PREFIX + 'BRIDGE');

    deviceDefs.forEach((def) => bridge.addBridgedAccessory(buildAccessory(def)));

    storage.events.on('change', ({ deviceId }) => refresh(Number(deviceId)));

    // hap-nodejs 는 listen 오류를 publish() 밖에서 비동기로 던져 프로세스가 죽으므로 포트를 먼저 확인
    if (!(await isPortFree(portNumber))) {
      console.error('[HomeKit] Port %d already in use — skipping', portNumber);
      return;
    }

    try {
      await bridge.publish({
        username: USERNAME,
        pincode: PINCODE,
        port: portNumber,
        category: Categories.BRIDGE,
        addIdentifyingMaterial: false // 브리지 이름 뒤에 해시 접미사(예: "IoT Simulator CAD8")를 붙이지 않음
      }, INSECURE);
      published = true;
      console.info('[HomeKit] Server started — port=%d pin=%s setupURI=%s insecure=%s',
        portNumber, PINCODE, bridge.setupURI(), INSECURE);
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        console.error('[HomeKit] Port %d already in use — skipping', portNumber);
      } else {
        console.error('[HomeKit] Server start failed — %s', err.message);
      }
    }
  }

};
