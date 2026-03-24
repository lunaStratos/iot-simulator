/**
 * JSON 파일 기반 스토리지 — MySQL 대체
 *
 * devices.json : 디바이스 마스터 정보 (읽기 전용)
 * values.json  : 디바이스 값 (읽기/쓰기)
 */
const fs = require('fs');
const path = require('path');

const DEVICES_PATH = path.join(__dirname, '../data/devices.json');
const VALUES_PATH  = path.join(__dirname, '../data/values.json');

let devices = [];
let values  = {};

function load() {
  try {
    devices = JSON.parse(fs.readFileSync(DEVICES_PATH, 'utf-8'));
    values  = JSON.parse(fs.readFileSync(VALUES_PATH, 'utf-8'));
    console.info('[Storage] Loaded — %d devices, %d value sets', devices.length, Object.keys(values).length);
  } catch (e) {
    console.error('[Storage] Load failed —', e.message);
  }
}

function saveValues() {
  try {
    fs.writeFileSync(VALUES_PATH, JSON.stringify(values, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Storage] Save failed —', e.message);
  }
}

// 초기 로드
load();

module.exports = {
  /**
   * 디바이스 상태 조회 — 기존 SQL 결과와 동일한 형태로 반환
   * @param {string|number} deviceId
   * @returns {{ id, name, firmware, version, serialNo, json }|null}
   */
  getDevice(deviceId) {
    const id = Number(deviceId);
    const dev = devices.find(d => d.id === id);
    if (!dev) return null;

    const vals = values[String(id)];
    if (!vals) return null;

    // 기존 API 응답과 호환되는 구조
    return {
      id: dev.id,
      name: dev.name,
      firmware: dev.firmware,
      version: dev.version,
      serialNo: dev.serialNo,
      json: { ...vals }
    };
  },

  /**
   * 디바이스 값 업데이트
   * @param {string|number} deviceId
   * @param {string} name  — 속성 이름 (switch, mode, ...)
   * @param {*} val         — 새 값
   * @returns {boolean}
   */
  setValue(deviceId, name, val) {
    const id = String(deviceId);
    if (!values[id]) return false;

    values[id][name] = String(val);
    saveValues();
    return true;
  },

  /**
   * 디바이스 값 조회 (단일)
   * @param {string|number} deviceId
   * @param {string} name
   * @returns {string|null}
   */
  getValue(deviceId, name) {
    const id = String(deviceId);
    if (!values[id]) return null;
    return values[id][name] ?? null;
  },

  /**
   * 디바이스 전체 값 맵 조회
   * @param {string|number} deviceId
   * @returns {object|null}
   */
  getValues(deviceId) {
    return values[String(deviceId)] || null;
  },

  /**
   * 모든 디바이스 ID 목록
   * @returns {number[]}
   */
  getDeviceIds() {
    return devices.map(d => d.id);
  },

  /**
   * 전체 값 맵 (Modbus/OPC-UA sync 용)
   * @returns {object}
   */
  getAllValues() {
    return values;
  },

  /**
   * 데이터 리로드
   */
  reload: load
};
