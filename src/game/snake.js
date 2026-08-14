import { linksInPath } from './dirs.js';

/** 설계 타임에 머리를 움직였을 때의 결과 */
export const TURN = {
  MOVED: 'moved',
  BLOCKED: 'blocked',    // 벽 / 쌓인 블록 / 뒤로 가기 — 아무 일도 일어나지 않음
  SELF_HIT: 'self-hit',  // 자기 몸 겹침 — 페널티로 그 자리에서 모양이 굳는다
};

/**
 * 플레이어가 조종하는 뱀 조각.
 * cells[0]이 머리이고, 나머지는 머리가 지나온 경로를 그대로 따라간다.
 */
export class Snake {
  constructor(cells, color) {
    this.cells = cells;
    this.color = color;
  }

  /** 가로 일자로 등장. 머리는 바라보는 방향(dir) 쪽 끝 칸. */
  static spawn(len, color, dir, cols, row = 0) {
    const start = Math.floor((cols - len) / 2);
    const cells = [];
    for (let i = 0; i < len; i++) cells.push([row, dir > 0 ? start + len - 1 - i : start + i]);
    return new Snake(cells, color);
  }

  get length() { return this.cells.length; }
  get head() { return this.cells[0]; }
  get neck() { return this.cells[1]; }

  /** 목 → 머리 = 지금 바라보는 방향 [dx, dy] */
  get facing() {
    const [hr, hc] = this.cells[0];
    const [nr, nc] = this.cells[1];
    return [hc - nc, hr - nr];
  }

  occupies(r, c) { return this.cells.some(([cr, cc]) => cr === r && cc === c); }

  /** index 칸이 앞뒤 칸으로 이어지는 방향 비트 (코너 스프라이트 판단용) */
  linksAt(index) { return linksInPath(this.cells, index); }

  /** 꼬리 끝이 몸통과 이어지는 방향 [dx, dy] */
  get tailDir() {
    const [tr, tc] = this.cells[this.cells.length - 1];
    const [pr, pc] = this.cells[this.cells.length - 2];
    return [pc - tc, pr - tr];
  }

  /** 설계 타임: 머리를 한 칸 옮기고 몸통이 따라온다 (길이는 그대로) */
  turn(dx, dy, board) {
    const [hr, hc] = this.head;
    const nr = hr + dy, nc = hc + dx;
    if (!board.free(nr, nc)) return TURN.BLOCKED;              // 벽 / 쌓인 블록
    const [br, bc] = this.neck;
    if (nr === br && nc === bc) return TURN.BLOCKED;           // 뒤로 가기
    if (this.occupies(nr, nc)) return TURN.SELF_HIT;
    this.cells.unshift([nr, nc]);
    this.cells.pop();
    return TURN.MOVED;
  }

  canShift(board, dr, dc) { return this.cells.every(([r, c]) => board.free(r + dr, c + dc)); }
  shift(dr, dc) { this.cells = this.cells.map(([r, c]) => [r + dr, c + dc]); }

  /** 지금 위치에서 바닥까지 몇 칸 남았는지 (섀도우 위치) */
  dropDistance(board) {
    let d = 0;
    while (this.cells.every(([r, c]) => board.free(r + d + 1, c))) d++;
    return d;
  }

  collides(board) { return this.cells.some(([r, c]) => !board.free(r, c)); }
}
