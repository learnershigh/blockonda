/** 캔버스를 화면 배율에 맞춰 준비하고 2D 컨텍스트를 돌려준다 */
export function createContext(canvas, width, height) {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false; // 16px 도트 스프라이트를 또렷하게
  return ctx;
}
