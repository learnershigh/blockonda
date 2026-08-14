import { DIRS } from '../config.js';

/** 방향 벡터 → 필드에 저장할 코드(1~4). 없으면 0 */
export function dirCode(dx, dy) {
  return DIRS.findIndex(([x, y]) => x === dx && y === dy) + 1;
}

/** 코드(1~4) → 방향 벡터. 0이면 머리가 아니므로 null */
export function dirVec(code) {
  return code ? DIRS[code - 1] : null;
}

/** 칸이 어느 쪽으로 이어져 있는지를 담는 비트. DIRS 순서와 같다. */
export const LINK = { LEFT: 1, RIGHT: 2, UP: 4, DOWN: 8 };

/** 방향 벡터 → 연결 비트 */
export function linkBit(dx, dy) {
  const code = dirCode(dx, dy);
  return code ? 1 << (code - 1) : 0;
}

/** 배열에서 index 앞뒤 칸으로 향하는 연결 비트 (cells는 머리부터 이어진 순서) */
export function linksInPath(cells, index) {
  const [r, c] = cells[index];
  let mask = 0;
  for (const i of [index - 1, index + 1]) {
    const other = cells[i];
    if (other) mask |= linkBit(other[1] - c, other[0] - r);
  }
  return mask;
}
