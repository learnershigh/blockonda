import { COLS, ROWS } from '../config.js';

const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const grid = (rows, cols) => Array.from({ length: rows }, () => Array(cols).fill(0));

/**
 * 쌓인 블록들의 필드.
 * 칸마다 세 가지를 기억한다.
 *  - color   : 색 번호(1~3), 0이면 빈 칸
 *  - pieceId : 어느 조각에서 왔는지 → 삭제 후 그 모양 그대로 떨어뜨리는 근거
 *  - head    : 머리 칸이면 바라보던 방향 코드(1~4), 몸통이면 0
 */
export class Board {
  constructor(cols = COLS, rows = ROWS) {
    this.cols = cols;
    this.rows = rows;
    this.clear();
  }

  clear() {
    this.color = grid(this.rows, this.cols);
    this.pieceId = grid(this.rows, this.cols);
    this.head = grid(this.rows, this.cols);
    this.nextId = 1;
  }

  inside(r, c) { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; }
  filled(r, c) { return this.inside(r, c) && this.color[r][c] !== 0; }
  free(r, c) { return this.inside(r, c) && this.color[r][c] === 0; }
  isEmpty() { return this.color.every(row => row.every(v => v === 0)); }

  /** 조각을 필드에 고정한다. cells[0]이 머리. */
  lock(cells, color, headCode) {
    const id = this.nextId++;
    for (const [r, c] of cells) {
      this.color[r][c] = color;
      this.pieceId[r][c] = id;
      this.head[r][c] = 0;
    }
    const [hr, hc] = cells[0];
    this.head[hr][hc] = headCode;
    return id;
  }

  remove(cells) {
    for (const [r, c] of cells) {
      this.color[r][c] = 0;
      this.pieceId[r][c] = 0;
      this.head[r][c] = 0;
    }
  }

  /** 같은 색으로 이어지고, 왼쪽 벽과 오른쪽 벽에 모두 닿은 덩어리들 */
  findSpanning() {
    return this.#components(
      (r, c) => this.color[r][c],
      cells => {
        const cs = cells.map(([, c]) => c);
        return Math.min(...cs) === 0 && Math.max(...cs) === this.cols - 1;
      },
    );
  }

  /** 삭제로 떠버린 블록을 조각 단위(강체)로 낙하시킨다 — 빈칸을 메우지 않는다 */
  applyGravity() {
    const chunks = this.#components((r, c) => this.pieceId[r][c]).map(cells => ({
      cells,
      set: new Set(cells.map(([r, c]) => r + ',' + c)),
    }));
    let moved = true;
    while (moved) {
      moved = false;
      for (const chunk of chunks) {
        if (!this.#chunkCanFall(chunk)) continue;
        this.#dropChunk(chunk);
        moved = true;
      }
    }
  }

  /** key(r,c)가 같고 4방향으로 이어진 칸 묶음들. accept로 걸러낸다. */
  #components(key, accept = () => true) {
    const seen = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
    const found = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.color[r][c] || seen[r][c]) continue;
        const id = key(r, c);
        const stack = [[r, c]];
        const cells = [];
        seen[r][c] = true;
        while (stack.length) {
          const [cr, cc] = stack.pop();
          cells.push([cr, cc]);
          for (const [dr, dc] of NEIGHBORS) {
            const nr = cr + dr, nc = cc + dc;
            if (!this.inside(nr, nc) || seen[nr][nc]) continue;
            if (!this.color[nr][nc] || key(nr, nc) !== id) continue;
            seen[nr][nc] = true;
            stack.push([nr, nc]);
          }
        }
        if (accept(cells)) found.push(cells);
      }
    }
    return found;
  }

  #chunkCanFall(chunk) {
    return chunk.cells.every(([r, c]) =>
      r + 1 < this.rows && (!this.color[r + 1][c] || chunk.set.has((r + 1) + ',' + c)));
  }

  #dropChunk(chunk) {
    const saved = chunk.cells.map(([r, c]) => [this.color[r][c], this.pieceId[r][c], this.head[r][c]]);
    this.remove(chunk.cells);
    chunk.cells = chunk.cells.map(([r, c]) => [r + 1, c]);
    chunk.cells.forEach(([r, c], i) => {
      [this.color[r][c], this.pieceId[r][c], this.head[r][c]] = saved[i];
    });
    chunk.set = new Set(chunk.cells.map(([r, c]) => r + ',' + c));
  }
}
