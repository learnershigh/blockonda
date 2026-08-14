import { DIRS } from '../config.js';

/** 방향 벡터 → 필드에 저장할 코드(1~4). 없으면 0 */
export function dirCode(dx, dy) {
  return DIRS.findIndex(([x, y]) => x === dx && y === dy) + 1;
}

/** 코드(1~4) → 방향 벡터. 0이면 머리가 아니므로 null */
export function dirVec(code) {
  return code ? DIRS[code - 1] : null;
}
