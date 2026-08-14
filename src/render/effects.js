import { CELL, COLS, DROP, FX, PALETTE } from '../config.js';
import { isReady } from '../assets.js';
import { dirVec } from '../game/dirs.js';
import { pickSprite } from './sprites.js';

/**
 * 삭제/착지 연출. 게임 로직과 분리되어 있어 시간(update)과 그리기(draw)만 담당한다.
 *  - 디졸브 : 칸을 조각으로 쪼개 흩날리며 사라짐
 *  - 타격감 : 백색 섬광 + 화면 흔들림 + 짧은 정지(hitstop)
 *  - 착지   : 카메라가 아래로 쿡 눌렸다 돌아오고, 부딪힌 면에서 먼지가 튄다
 */
const DUST_COLOR = '#cfd8ea';
export class Effects {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
    this.clear();
  }

  clear() {
    this.cells = [];   // 디졸브 중인 칸
    this.rows = [];    // 삭제된 줄을 훑는 섬광
    this.dust = [];    // 착지 먼지
    this.time = 0;
    this.shake = 0;
    this.hitstop = 0;
    this.kick = 0;     // 카메라가 아래로 눌린 정도(px)
    this.kickLeft = 0; // 남은 복귀 시간(ms)
  }

  /** hitstop 동안에는 게임 시간이 멈춘다 */
  get frozen() { return this.hitstop > 0; }
  get busy() { return this.cells.length > 0 || this.rows.length > 0 || this.dust.length > 0; }

  /** Game의 onClear가 넘겨준 라운드들로 연출을 만든다 */
  spawn(rounds) {
    for (const { cells, chain } of rounds) {
      const rows = new Set();
      for (const { r, c, color, head, tail, link } of cells) {
        const seed = [], jitter = [];
        for (let i = 0; i < FX.split * FX.split; i++) {
          seed.push(0.2 + this.rng() * 0.8);   // 조각마다 사라지는 시점
          jitter.push(this.rng());             // 조각마다 튀는 방향
        }
        this.cells.push({ r, c, color, head, tail, link, born: this.time, seed, jitter });
        rows.add(r);
      }
      for (const r of rows) this.rows.push({ r, born: this.time });
      this.shake = Math.min(FX.shakeMax, this.shake + 6 + cells.length * 0.25 + (chain - 1) * 4);
      this.hitstop = Math.max(this.hitstop, 90 + (chain - 1) * 40);
    }
  }

  /**
   * Game의 onImpact가 넘겨준 착지 정보로 만드는 가벼운 연출.
   * 삭제 연출과 달리 게임 시간은 멈추지 않는다 — 하드드롭마다 걸리면 답답해진다.
   */
  impact({ cells, distance }) {
    const power = Math.min(1, distance / DROP.full);
    if (power <= 0) return;                 // 이미 바닥에 붙어 있었다면 아무 일도 없다

    this.shake = Math.min(FX.shakeMax, this.shake + DROP.shake * power);
    this.kick = DROP.kick * power;
    this.kickLeft = DROP.kickMs;

    for (const [r, c] of cells) {
      const count = Math.max(1, Math.round(DROP.dust * power));
      for (let i = 0; i < count; i++) {
        const side = this.rng() * 2 - 1;     // 좌우로 갈라지며 튄다
        this.dust.push({
          x: c * CELL + CELL * (0.5 + side * 0.45),
          y: (r + 1) * CELL,
          vx: side * DROP.dustSpeed * (0.6 + this.rng() * 0.8),
          vy: -DROP.dustSpeed * (0.5 + this.rng() * 0.9) * (0.6 + power * 0.4),
          born: this.time,
        });
      }
    }
  }

  update(dt) {
    this.time += dt;
    if (this.hitstop > 0) this.hitstop -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * FX.shakeDecay);
    if (this.kickLeft > 0) this.kickLeft = Math.max(0, this.kickLeft - dt);
    if (this.cells.length) this.cells = this.cells.filter(f => this.time - f.born < FX.dissolveMs);
    if (this.rows.length) this.rows = this.rows.filter(f => this.time - f.born < FX.rowFlashMs);
    if (this.dust.length) {
      for (const d of this.dust) {
        d.x += d.vx * dt;
        d.vy += DROP.gravity * dt;
        d.y += d.vy * dt;
      }
      this.dust = this.dust.filter(d => this.time - d.born < DROP.dustMs);
    }
  }

  /** 화면 흔들림 offset — 렌더러가 필드를 그리기 전에 적용한다 */
  shakeOffset() {
    const t = this.kickLeft / DROP.kickMs;
    const kick = t > 0 ? this.kick * t * t : 0; // 쿡 눌렸다가 빠르게 제자리로
    if (this.shake <= 0.2) return [0, kick];
    return [(this.rng() * 2 - 1) * this.shake, (this.rng() * 2 - 1) * this.shake + kick];
  }

  draw(ctx) {
    this.#drawRowFlash(ctx);
    this.#drawDissolve(ctx);
    this.#drawDust(ctx);
    ctx.globalAlpha = 1;
  }

  #drawDust(ctx) {
    ctx.fillStyle = DUST_COLOR;
    for (const d of this.dust) {
      const p = (this.time - d.born) / DROP.dustMs;
      if (p >= 1) continue;
      ctx.globalAlpha = (1 - p) * 0.7;
      ctx.fillRect(Math.round(d.x), Math.round(d.y), DROP.dustSize, DROP.dustSize);
    }
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
      const { img } = pickSprite(f.color, { head: dirVec(f.head), tail: dirVec(f.tail), links: f.link });
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
