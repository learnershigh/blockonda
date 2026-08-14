/**
 * drawImage 호출을 변환행렬(좌우반전/회전)과 함께 기록하는 캔버스 스텁.
 * 스프라이트가 "어느 방향을 보고" 그려졌는지까지 검증하기 위한 것.
 */
export function createStubContext() {
  let m = [1, 0, 0, 1, 0, 0]; // [a,b,c,d,e,f]: (x,y) -> (a*x + c*y + e, b*x + d*y + f)
  const stack = [];
  const target = {
    draws: [],
    globalAlpha: 1,
    save() { stack.push(m.slice()); },
    restore() { if (stack.length) m = stack.pop(); },
    translate(tx, ty) { m[4] += m[0] * tx + m[2] * ty; m[5] += m[1] * tx + m[3] * ty; },
    scale(sx, sy) { m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; },
    rotate(t) {
      const co = Math.cos(t), si = Math.sin(t), [a, b, c, d] = m;
      m[0] = a * co + c * si; m[1] = b * co + d * si;
      m[2] = -a * si + c * co; m[3] = -b * si + d * co;
    },
    drawImage(img) {
      const [a, b, c, d] = m;
      target.draws.push({
        src: img.src,
        alpha: target.globalAlpha,
        x: m[4], y: m[5],              // 로컬 (0,0) = 칸 중심
        nose: [round(-a), round(-b)],  // 원본이 왼쪽(-x)을 보므로 실제 바라보는 방향
        // 원본 기준 방향이 화면에서 어디를 향하게 되는지
        mapDir: ([vx, vy]) => [round(a * vx + c * vy), round(b * vx + d * vy)],
      });
    },
  };
  return new Proxy(target, {
    get: (t, k) => (k in t ? t[k] : () => {}),
    set: (t, k, v) => (t[k] = v, true),
  });
}

/** 브라우저의 Image 대신 쓰는 가짜 이미지 로더 */
export function stubImages() {
  globalThis.Image = class {
    constructor() { this.complete = true; this.naturalWidth = 16; this.src = ''; }
  };
}

const round = v => {
  const r = Math.round(v * 100) / 100;
  return r === 0 ? 0 : r; // -0을 0으로 정규화
};
