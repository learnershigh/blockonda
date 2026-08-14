/**
 * 캔버스를 화면 배율(devicePixelRatio)에 맞춰 준비한다.
 *
 * 윈도우의 125%/150% 디스플레이 배율이나 브라우저 확대에서는 배율이 소수(1.25, 1.5...)라
 * 한 칸(30 CSS px)이 화면 픽셀 경계에 딱 떨어지지 않는다. 그러면 이웃한 칸을 각각 반올림해
 * 그리는 과정에서 사이에 한 픽셀짜리 빈 줄이 생긴다. 그래서 여기서 두 가지를 보장한다.
 *  - backing store 크기를 정수로 잡고, 실제로 잡힌 크기로 변환을 건다 (소수는 잘려서 어긋난다)
 *  - 화면 한 픽셀의 크기(devicePixel)를 알려줘서, 그리는 쪽이 이음매를 메우거나 좌표를 맞물리게 한다
 */
let pixel = 1; // 화면 한 픽셀 = 몇 CSS px 인가 (배율 1.25면 0.8)

/** 화면 한 픽셀의 CSS 크기 */
export function devicePixel() { return pixel; }

/** 화면 픽셀 격자에 딱 맞는 값으로 붙인다 (흔들림 offset처럼 소수로 움직이는 값용) */
export function snapToPixel(value) { return Math.round(value / pixel) * pixel; }

/** 배율이 정수가 아닐 때만 필요한 이음매 보정 두께(CSS px). 한 칸을 이만큼 키워 겹쳐 그린다. */
export function seamBleed() {
  const scale = 1 / pixel;
  return Number.isInteger(scale) ? 0 : pixel;
}

export function createContext(canvas, width, height) {
  const ctx = canvas.getContext('2d');
  const fit = () => fitToScreen(canvas, ctx, width, height);
  fit();
  // 창을 확대하거나 배율이 다른 모니터로 옮기면 resize가 뜬다 — 그때 다시 잡아야 또렷하다
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', fit);
  return ctx;
}

function fitToScreen(canvas, ctx, width, height) {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const w = Math.round(width * dpr);
  const h = Math.round(height * dpr);
  if (canvas.width !== w || canvas.height !== h) {   // 크기를 다시 넣으면 캔버스가 지워진다
    canvas.width = w;
    canvas.height = h;
  }
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  pixel = width / w;                                 // 반올림한 뒤의 진짜 배율
  ctx.setTransform?.(w / width, 0, 0, h / height, 0, 0);
  ctx.imageSmoothingEnabled = false;                 // 16px 도트 스프라이트를 또렷하게
}
