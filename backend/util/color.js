/**
 * HEX ↔ Hue/Saturation 변환 — HomeKit / Matter 조명 색상 매핑용
 *
 * HomeKit, Matter 는 색상을 Hue(0~360) / Saturation(0~100) 으로 다루고
 * 스토리지는 HEX 문자열(#fff, #f05348 …)로 저장한다.
 * UI 프리셋 색상은 명도가 100% 가 아니므로, 변환 결과가 프리셋과
 * 거의 같은 색상이면 프리셋 HEX 를 그대로 돌려줘 왕복 변환 시 값이 유지되게 한다.
 */

// 스마트 LED UI 프리셋 (frontend/src/pages/SwitchPage.vue 와 동일)
const PRESET_COLORS = ['#fff', '#f05348', '#f08848', '#f0c048', '#48f072', '#486af0', '#8348f0', '#1d0f6b'];

// 프리셋 스냅 허용 오차 (Matter 양자화 오차 1.42° / 0.4% 를 흡수)
const HUE_TOLERANCE = 2;
const SAT_TOLERANCE = 2;

function parseHex(hex) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

/**
 * HEX → { hue: 0~360, saturation: 0~100 }
 * 파싱 불가한 값은 흰색(0, 0)으로 처리
 */
function hexToHs(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return { hue: 0, saturation: 0 };

  const [r, g, b] = rgb.map(v => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const saturation = max === 0 ? 0 : (d / max) * 100;
  return { hue: Math.round(hue), saturation: Math.round(saturation) };
}

function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * { hue, saturation } → HEX (#rrggbb, 명도 100%)
 * 프리셋 색상과 오차 범위 내면 프리셋 HEX 반환
 */
function hsToHex(hue, saturation) {
  const h = ((Number(hue) || 0) % 360 + 360) % 360;
  const s = Math.min(100, Math.max(0, Number(saturation) || 0));

  for (const preset of PRESET_COLORS) {
    const p = hexToHs(preset);
    const satOk = Math.abs(p.saturation - s) <= SAT_TOLERANCE;
    // 채도가 0 에 가까우면 색상(hue)은 의미가 없음
    if (satOk && (p.saturation <= SAT_TOLERANCE || hueDistance(p.hue, h) <= HUE_TOLERANCE)) {
      return preset;
    }
  }

  const c = s / 100;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = 1 - c;
  let rgb;
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return '#' + rgb.map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

/**
 * Hue / Saturation 이 따로 쓰여도 값을 잃지 않도록 유지하는 색상 상태
 *
 * 컨트롤러는 Hue 와 Saturation 을 개별 쓰기로 보내는 경우가 많다.
 * 매번 스토리지 HEX 에서 다시 계산하면, 예컨대 흰색(채도 0)에 Hue 만 먼저 쓸 때
 * 결과가 다시 흰색으로 스냅되어 Hue 가 사라지므로 마지막 HS 값을 메모리에 보관한다.
 */
class HsColorState {
  constructor(hex) {
    this.sync(hex);
  }

  /** 외부(스토리지)에서 바뀐 HEX 반영 — 자신이 쓴 값이면 무시 */
  sync(hex) {
    if (hex === this.hex) return;
    Object.assign(this, hexToHs(hex));
    this.hex = hex;
  }

  /** hue / saturation 일부 갱신 후 HEX 반환 */
  update(partial) {
    Object.assign(this, partial);
    this.hex = hsToHex(this.hue, this.saturation);
    return this.hex;
  }
}

module.exports = { hexToHs, hsToHex, HsColorState };
