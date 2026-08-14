import { CELL, COLS, COMBO, CONFIRM, DROP, FX, PALETTE, PENALTY, ROWS } from '../config.js';
import { isReady } from '../assets.js';
import { dirVec } from '../game/dirs.js';
import { seamBleed } from './canvas.js';
import { pickSprite } from './sprites.js';

/**
 * 삭제/착지 연출. 게임 로직과 분리되어 있어 시간(update)과 그리기(draw)만 담당한다.
 *  - 디졸브 : 칸을 조각으로 쪼개 흩날리며 사라짐
 *  - 콤보   : 연속으로 터뜨린 횟수를 "nCombo!"로 띄움
 *  - 타격감 : 백색 섬광 + 화면 흔들림 + 짧은 정지(hitstop)
 *  - 착지   : 카메라가 아래로 쿡 눌렸다 돌아오고, 부딪힌 면에서 먼지가 튄다
 *  - 페널티 : 자기 몸을 밟으면 화면이 흔들리고 뱀이 붉게 달아오른다
 *  - 확정   : 모양이 굳는 순간 뱀이 하얗게 번쩍이고 반짝이가 튄다
 */
const DUST_COLOR = '#cfd8ea';
const SPARK_COLOR = '#ffffff';
export class Effects {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
    this.clear();
  }

  clear() {
    this.cells = [];   // 디졸브 중인 칸
    this.rows = [];    // 삭제된 줄을 훑는 섬광
    this.dust = [];    // 착지 먼지
    this.sparks = [];  // 확정 순간 튀는 반짝임
    this.combo = null; // 떠 있는 "nCombo!" 한 개 { n, born }
    this.time = 0;
    this.shake = 0;
    this.hitstop = 0;
    this.kick = 0;      // 카메라가 아래로 눌린 정도(px)
    this.kickLeft = 0;  // 남은 복귀 시간(ms)
    this.flashLeft = 0; // 페널티 붉은 섬광이 남은 시간(ms)
    this.glowLeft = 0;  // 확정 백색 섬광이 남은 시간(ms)
    this.quiverLeft = 0; // 확정 순간 뱀이 떠는 시간(ms)
  }

  /** hitstop 동안에는 게임 시간이 멈춘다 */
  get frozen() { return this.hitstop > 0; }
  /** 페널티로 뱀이 달아오른 정도 1 → 0. 뱀은 렌더러가 그리므로 세기만 넘겨준다. */
  get penaltyFlash() { return this.flashLeft / PENALTY.flashMs; }
  /** 확정으로 뱀이 하얗게 뜬 정도 1 → 0. 마찬가지로 세기만 넘겨준다. */
  get confirmGlow() { return this.glowLeft / CONFIRM.flashMs; }
  get busy() {
    return this.cells.length > 0 || this.rows.length > 0
      || this.dust.length > 0 || this.sparks.length > 0 || this.combo !== null;
  }

  /** clear 이벤트가 넘겨준 연쇄 한 라운드로 연출을 만든다 */
  spawn({ cells, chain }) {
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

    // 콤보는 연쇄에서만 터진다. 조각마다 한 줄씩 지운 건 이어 붙여도 콤보가 아니다 —
    // 한 번 굳힌 게 스스로 다음 삭제를 부른 것, 그게 콤보다.
    // 한 번에 하나만 띄운다. 연쇄가 빠르게 이어질 때 숫자가 겹치면 오히려 못 읽는다.
    if (chain >= COMBO.min) this.combo = { n: chain, born: this.time };
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

  /**
   * 자기 몸에 부딪혔을 때의 페널티 연출.
   * 점수를 깎는 대신 화면을 흔들고 뱀을 붉게 달궈 "지금 실수했다"를 손으로 느끼게 한다.
   * 게임 시간은 멈추지 않는다 — 페널티로 이미 낙하가 시작되기 때문.
   */
  penalty() {
    this.shake = Math.min(FX.shakeMax, this.shake + PENALTY.shake);
    this.flashLeft = PENALTY.flashMs;
  }

  /** 달아오른 조각이 굳으면 붉은 기운도 거기서 끝난다 — 다음 조각까지 물들지 않게 */
  endPenalty() { this.flashLeft = 0; }

  /**
   * 설계가 끝나 모양이 확정된 순간. 뱀이 하얗게 번쩍이며 몸을 떨고 반짝이가 튄다.
   * 화면은 흔들지 않고 게임 시간도 멈추지 않는다 —
   * 잘못한 게 아니라 "이 모양으로 굳었다"는 신호라서 조각 하나에서만 일어난다.
   */
  confirm(cells) {
    this.glowLeft = CONFIRM.flashMs;
    this.quiverLeft = CONFIRM.shakeMs;
    for (const [r, c] of cells) {
      for (let i = 0; i < CONFIRM.sparks; i++) {
        const angle = this.rng() * Math.PI * 2;   // 사방으로 흩어진다
        const speed = CONFIRM.sparkSpeed * (0.4 + this.rng() * 0.8);
        this.sparks.push({
          x: c * CELL + CELL * (0.2 + this.rng() * 0.6),
          y: r * CELL + CELL * (0.2 + this.rng() * 0.6),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
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
    if (this.flashLeft > 0) this.flashLeft = Math.max(0, this.flashLeft - dt);
    if (this.glowLeft > 0) this.glowLeft = Math.max(0, this.glowLeft - dt);
    if (this.quiverLeft > 0) this.quiverLeft = Math.max(0, this.quiverLeft - dt);
    if (this.combo && this.time - this.combo.born >= COMBO.showMs) this.combo = null;
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
    if (this.sparks.length) {
      for (const s of this.sparks) {
        s.x += s.vx * dt;
        s.vy += CONFIRM.gravity * dt;
        s.y += s.vy * dt;
      }
      this.sparks = this.sparks.filter(s => this.time - s.born < CONFIRM.sparkMs);
    }
  }

  /**
   * 확정 순간 뱀이 떠는 offset. 화면 흔들림과 달리 조작 중인 조각 하나에만 걸리므로
   * 필드와 쌓인 블록은 가만히 있고 뱀만 부르르 떤다.
   */
  snakeOffset() {
    const t = this.quiverLeft / CONFIRM.shakeMs;
    if (t <= 0) return [0, 0];
    const amp = CONFIRM.shake * t;
    return [(this.rng() * 2 - 1) * amp, (this.rng() * 2 - 1) * amp];
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
    this.#drawSparks(ctx);
    ctx.globalAlpha = 1;
    this.#drawCombo(ctx); // 맨 마지막 — 쌓인 블록에도 디졸브에도 가리지 않는다
  }

  /**
   * "nCombo!" 팝업. 튀어오르며 나타나 천천히 떠오르다 사라진다.
   * 콤보가 쌓일수록 글자가 커지고 색이 뜨거워져서, 숫자를 읽지 않아도 기세가 보인다.
   */
  #drawCombo(ctx) {
    if (!this.combo) return;
    const { n, born } = this.combo;
    const age = this.time - born;
    const p = age / COMBO.showMs;
    if (p >= 1) return;

    const pop = 1 + (COMBO.popScale - 1) * Math.max(0, 1 - age / COMBO.popMs);
    const size = Math.min(COMBO.maxSize, COMBO.size + (n - COMBO.min) * COMBO.grow);
    const color = COMBO.colors[Math.min(COMBO.colors.length - 1, n - COMBO.min)];
    const x = COLS * CELL / 2;
    const y = ROWS * CELL * COMBO.y - COMBO.rise * (1 - (1 - p) * (1 - p)); // 끝으로 갈수록 천천히
    const text = `${n}Combo!`;

    ctx.save();
    ctx.globalAlpha = p < COMBO.fadeAt ? 1 : 1 - (p - COMBO.fadeAt) / (1 - COMBO.fadeAt);
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.font = `700 ${size}px ${COMBO.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = COMBO.outlineWidth;
    ctx.lineJoin = 'round'; // 획 끝이 뾰족하게 삐져나오지 않게
    ctx.strokeStyle = COMBO.outline;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  #drawSparks(ctx) {
    ctx.fillStyle = SPARK_COLOR;
    for (const s of this.sparks) {
      const p = (this.time - s.born) / CONFIRM.sparkMs;
      if (p >= 1) continue;
      ctx.globalAlpha = 1 - p * p;   // 끝에서 훅 꺼진다
      ctx.fillRect(Math.round(s.x), Math.round(s.y), CONFIRM.sparkSize, CONFIRM.sparkSize);
    }
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
      const drawn = tile + seamBleed();  // 흩어지기 직전까지는 한 덩어리로 보여야 한다
      const src = (ok ? img.naturalWidth : 16) / n;
      const x = f.c * CELL, y = f.r * CELL;

      ctx.fillStyle = PALETTE[f.color - 1];
      for (let i = 0; i < n * n; i++) {
        if (f.seed[i] < p) continue;                      // 이미 흩어져 사라진 조각
        const tx = i % n, ty = (i / n) | 0;
        const jx = (f.jitter[i] * 2 - 1) * p * 15;        // 좌우로 튀고
        const jy = -p * p * 24 - p * 5;                   // 살짝 떠오른다
        ctx.globalAlpha = Math.max(0, 1 - p * 0.85);
        if (ok) ctx.drawImage(img, tx * src, ty * src, src, src, x + tx * tile + jx, y + ty * tile + jy, drawn, drawn);
        else ctx.fillRect(x + tx * tile + jx, y + ty * tile + jy, drawn, drawn);
      }
      if (p < 0.3) {                                      // 터지는 순간의 백색 섬광
        ctx.globalAlpha = (1 - p / 0.3) * 0.9;
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, CELL, CELL);
      }
    }
  }
}
