const MAX_DT = 250; // 탭이 백그라운드였다가 돌아왔을 때 한 번에 몰아치지 않도록

/** 매 프레임 dt(ms)를 넘겨주는 렌더 루프 */
export function startLoop(step) {
  let last = performance.now();
  const frame = now => {
    const dt = Math.min(now - last, MAX_DT);
    last = now;
    step(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
