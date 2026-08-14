import { CELL, COLS, FX, PALETTE } from '../config.js';
import { isReady } from '../assets.js';
import { dirVec } from '../game/dirs.js';
import { pickSprite } from './sprites.js';

/**
 * 삭제 연출. 게임 로직과 분리되어 있어 시간(update)과 그리기(draw)만 담당한다.
 *  - 디졸브 : 칸을 조각으로 쪼개 흩날리며 사라짐
 *  - 타격감 : 백색 섬광 + 화면 흔들림 + 짧은 정지(hitstop)
 */
export class Effects {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
    this.clear();
  }

  clear() {
    this.cells = [];   // 디졸브 중인 칸
    this.rows = [];    // 삭제된 줄을 훑는 섬광
    this.time = 0;
    this.shake = 0;
    this.hitstop = 0;
  }

  /** hitstop 동안에는 게임 시간이 멈춘다 */
  get frozen() { return this.hitstop > 0; }
  get busy() { return this.cells.length > 0 || this.rows.length > 0; }

  /** Game의 onClear가 넘겨준 라운드들로 연출을 만든다 */
  spawn(rounds) {
    for (const { cells, chain } of rounds) {
      const rows = new Set();
      for (const { r, c, color, head, link } of cells) {
        const seed = [], jitter = [];
        for (let i = 0; i < FX.split * FX.split; i++) {
          seed.push(0.2 + this.rng() * 0.8);   // 조각마다 사라지는 시점
          jitter.push(this.rng());             // 조각마다 튀는 방향
        }
        this.cells.push({ r, c, color, head, link, born: this.time, seed, jitter });
        rows.add(r);
      }
      for (const r of rows) this.rows.push({ r, born: this.time });
      this.shake = Math.min(FX.shakeMax, this.shake + 6 + cells.length * 0.25 + (chain - 1) * 4);
      this.hitstop = Math.max(this.hitstop, 90 + (chain - 1) * 40);
    }
  }

  update(dt) {
    this.time += dt;
    if (this.hitstop > 0) this.hitstop -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * FX.shakeDecay);
    if (this.cells.length) this.cells = this.cells.filter(f => this.time - f.born < FX.dissolveMs);
    if (this.rows.length) this.rows = this.rows.filter(f => this.time - f.born < FX.rowFlashMs);
  }

  /** 화면 흔들림 offset — 렌더러가 필드를 그리기 전에 적용한다 */
  shakeOffset() {
    if (this.shake <= 0.2) return [0, 0];
    return [(this.rng() * 2 - 1) * this.shake, (this.rng() * 2 - 1) * this.shake];
  }

  draw(ctx) {
    this.#drawRowFlash(ctx);
    this.#drawDissolve(ctx);
    ctx.globalAlpha = 1;
  }

  #drawRowFlash(ctx) {
    for (const f of this.rows) {
      const p = (this.time - f.born) / FX.rowFlashMs;
      if (p >= 1) continue;
      ctx.globalAlpha = (1 - p) * 0.55;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, f.r * CELL + CELL * (0.12 + p * 0.35), COLS * CELL, CELL * (0.76 - p * 0.7));
    }
  }

  #drawDissolve(ctx) {
    const n = FX.split;
    for (const f of this.cells) {
      const p = (this.time - f.born) / FX.dissolveMs;
      if (p >= 1) continue;
      // 흩어지는 조각이라 회전까지는 따지지 않고, 어떤 그림인지만 맞춘다
      const { img } = pickSprite(f.color, { head: dirVec(f.head), links: f.link });
      const ok = isReady(img);
      const tile = CELL / n;
      const src = (ok ? img.naturalWidth : 16) / n;
      const x = f.c * CELL, y = f.r * CELL;

      ctx.fillStyle = PALETTE[f.color - 1];
      for (let i = 0; i < n * n; i++) {
        if (f.seed[i] < p) continue;                      // 이미 흩어져 사라진 조각
        const tx = i % n, ty = (i / n) | 0;
        const jx = (f.jitter[i] * 2 - 1) * p * 15;        // 좌우로 튀고
        const jy = -p * p * 24 - p * 5;                   // 살짝 떠오른다
        ctx.globalAlpha = Math.max(0, 1 - p * 0.85);
        if (ok) ctx.drawImage(img, tx * src, ty * src, src, src, x + tx * tile + jx, y + ty * tile + jy, tile, tile);
        else ctx.fillRect(x + tx * tile + jx, y + ty * tile + jy, tile, tile);
      }
      if (p < 0.3) {                                      // 터지는 순간의 백색 섬광
        ctx.globalAlpha = (1 - p / 0.3) * 0.9;
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, CELL, CELL);
      }
    }
  }
}
