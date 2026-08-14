import { MAX_LEN, MIN_LEN, PACE, PALETTE, SCORE, SPAWN_ROW } from '../config.js';
import { Board } from './board.js';
import { Cascade } from './clear.js';
import { dirCode } from './dirs.js';
import { Snake, TURN } from './snake.js';

export const PHASE = {
  DESIGN: 'design', // 정해진 시간 동안 방향키로 모양을 만드는 중
  FALL: 'fall',     // 모양이 확정되어 떨어지는 중
  CLEAR: 'clear',   // 연쇄 삭제가 한 단계씩 진행되는 중 — 조작할 조각이 없다
};

export const ACTION = {
  LEFT: 'left', RIGHT: 'right', UP: 'up', DOWN: 'down', SPACE: 'space',
};

/**
 * 게임에서 일어난 일. 연출(effects)과 효과음(sound)이 이걸 보고 반응한다.
 * 값은 config.js의 SOUND.events 키와 그대로 맞물린다.
 */
export const EVENT = {
  SPAWN: 'spawn',        // 새 조각 등장
  MOVE: 'move',          // 설계 중 머리 이동 / 낙하 중 좌우 이동
  SELF_HIT: 'self-hit',  // 자기 몸에 부딪혀 그 자리에서 굳음
  LAND: 'land',          // 바닥이나 블록에 닿아 고정 { cells, distance }
  CLEAR: 'clear',        // 덩어리 삭제 — 연쇄 한 라운드마다 한 번 { chain, combo, groups, cells, points }
  OVER: 'over',          // 게임 오버
};

/**
 * 게임 규칙 전체. 렌더링과 DOM을 전혀 모르며, 시간은 update(dt)로만 흐른다.
 * 바깥에는 onEvent(type, data)로 "무엇이 일어났는지"만 알리고,
 * 그게 어떻게 보이고 들릴지는 전부 바깥이 정한다.
 */
export class Game {
  constructor({ rng = Math.random, onEvent = null } = {}) {
    this.rng = rng;
    this.onEvent = onEvent;
    this.board = new Board();
    this.reset();
  }

  #emit(type, data) {
    if (this.onEvent) this.onEvent(type, data);
  }

  reset() {
    this.board.clear();
    this.score = 0;
    this.lines = 0;      // 터뜨린 덩어리 수
    this.combo = 0;      // 연속으로 터뜨린 횟수 — 못 터뜨린 조각이 굳으면 0으로 끊긴다
    this.placed = 0;     // 쌓은 블록 수 (표시/통계용 — 난이도는 점수를 따른다)
    this.over = false;
    this.colorBag = [];
    this.cascade = null; // 연쇄 삭제가 진행 중일 때만 있다
    this.next = this.#randomPiece();
    this.spawn();
  }

  spawn() {
    this.cascade = null;
    const { len, color, dir } = this.next;
    this.snake = Snake.spawn(len, color, dir, this.board.cols, SPAWN_ROW);
    this.next = this.#randomPiece();
    this.phase = PHASE.DESIGN;
    this.designLeft = this.designTime; // 조각이 나오는 순간의 점수로 정해지고 그대로 간다
    this.acc = 0;
    if (this.snake.collides(this.board)) this.over = true; // 등장 자리가 이미 막힘
    this.#emit(this.over ? EVENT.OVER : EVENT.SPAWN);
  }

  /** 설계를 끝내고 낙하 시작 */
  confirm() {
    this.phase = PHASE.FALL;
    this.acc = 0;
  }

  input(action) {
    if (this.over || this.phase === PHASE.CLEAR) return; // 연쇄가 끝날 때까지는 조작할 조각이 없다
    if (this.phase === PHASE.DESIGN) return this.#designInput(action);
    return this.#fallInput(action);
  }

  update(dt) {
    if (this.over) return;
    if (this.phase === PHASE.CLEAR) return this.#updateCascade(dt);
    if (this.phase === PHASE.DESIGN) {
      this.designLeft -= dt;
      if (this.designLeft <= 0) this.confirm();
      return;
    }
    this.acc += dt;
    let interval = this.dropInterval;
    while (this.acc >= interval && !this.over && this.phase === PHASE.FALL) {
      this.acc -= interval;
      this.#gravityStep();
      interval = this.dropInterval;
    }
  }

  /**
   * 난이도 진행도 0 → 1. 점수가 오를수록 1에 가까워지고, PACE.full부터는 계속 1이다.
   * 설계 시간과 낙하 속도가 둘 다 이 값 하나를 따라간다.
   */
  get pace() { return Math.min(1, this.score / PACE.full); }

  /** 이번 조각에 주어지는 설계 시간(ms) — 점수가 오를수록 짧아진다 */
  get designTime() { return PACE.designMax - (PACE.designMax - PACE.designMin) * this.pace; }

  /** 한 칸 떨어지는 데 걸리는 시간(ms) — 점수가 오를수록 짧아진다 */
  get dropInterval() { return PACE.dropMax - (PACE.dropMax - PACE.dropMin) * this.pace; }

  /** 설계 타임 남은 시간(초, 표시용) */
  get designSeconds() { return Math.max(0, this.designLeft) / 1000; }

  /**
   * 화면에 그릴 조각이 있는가.
   * 연쇄 연출 중에는 snake가 이미 필드에 굳어 있어서 그대로 그리면 두 겹으로 보인다.
   */
  get hasPiece() { return !this.over && this.phase !== PHASE.CLEAR; }

  #designInput(action) {
    const turn = {
      [ACTION.LEFT]: [-1, 0], [ACTION.RIGHT]: [1, 0],
      [ACTION.UP]: [0, -1], [ACTION.DOWN]: [0, 1],
    }[action];
    if (turn) {
      const result = this.snake.turn(turn[0], turn[1], this.board);
      // 자기 몸에 부딪히면 페널티로 그 모양 그대로 굳는다
      if (result === TURN.SELF_HIT) {
        this.#emit(EVENT.SELF_HIT);
        this.confirm();
      } else if (result === TURN.MOVED) this.#emit(EVENT.MOVE);
      return;
    }
    if (action === ACTION.SPACE) this.confirm();
  }

  #fallInput(action) {
    switch (action) {
      case ACTION.LEFT:
      case ACTION.RIGHT: {
        const dc = action === ACTION.LEFT ? -1 : 1;
        if (this.snake.canShift(this.board, 0, dc)) {
          this.snake.shift(0, dc);
          this.#emit(EVENT.MOVE);
        }
        break;
      }
      case ACTION.DOWN: this.#softDrop(); break;
      case ACTION.SPACE: this.#hardDrop(); break;
    }
  }

  #softDrop() {
    if (this.snake.canShift(this.board, 1, 0)) {
      this.snake.shift(1, 0);
      this.score += SCORE.soft;
      this.acc = 0;
    } else this.#lock();
  }

  #hardDrop() {
    let distance = 0;
    while (this.snake.canShift(this.board, 1, 0)) {
      this.snake.shift(1, 0);
      this.score += SCORE.hard;
      distance++;
    }
    this.#lock(distance);
  }

  #gravityStep() {
    if (this.snake.canShift(this.board, 1, 0)) this.snake.shift(1, 0);
    else this.#lock();
  }

  /** distance = 하드드롭으로 떨어진 칸 수. 저절로 닿았으면 0이라 착지가 부드럽다. */
  #lock(distance = 0) {
    // 굳기 전에 알려야 부딪힌 면이 아직 뱀의 것으로 남아 있다
    this.#emit(EVENT.LAND, { cells: this.snake.contactCells(), distance });

    const [dx, dy] = this.snake.facing;
    this.board.lock(this.snake.cells, this.snake.color, dirCode(dx, dy));
    this.placed++;

    // 터질 게 있으면 연쇄를 한 단계씩 진행하고(그동안 다음 조각은 기다린다), 없으면 곧장 다음 조각
    this.cascade = new Cascade(this.board);
    if (this.#popRound()) this.phase = PHASE.CLEAR;
    else {
      this.combo = 0; // 아무것도 못 터뜨린 채 굳었다 — 여기서 연속이 끊긴다
      this.spawn();
    }
  }

  /** 연쇄 한 라운드를 터뜨리고 점수/콤보에 반영한다. 터질 게 없으면 false */
  #popRound() {
    const round = this.cascade.pop();
    if (!round) return false;
    this.score += round.points;
    this.lines += round.groups;
    // 콤보는 연쇄(chain)와 달리 조각이 바뀌어도 이어진다 — 끊는 건 못 터뜨린 착지뿐이다
    this.combo++;
    this.#emit(EVENT.CLEAR, { ...round, combo: this.combo });
    return true;
  }

  /** 터짐 → 낙하 → 자리잡음을 시간에 맞춰 밟아 나가고, 연쇄가 끝나면 다음 조각을 부른다 */
  #updateCascade(dt) {
    if (this.cascade.step(dt)) return; // 아직 떨어지는 중
    if (this.#popRound()) return;      // 낙하로 새 연결이 생겼다 — 다음 연쇄
    this.spawn();
  }

  #randomPiece() {
    return {
      len: MIN_LEN + Math.floor(this.rng() * (MAX_LEN - MIN_LEN + 1)),
      color: this.#takeColor(),
      dir: this.rng() < 0.5 ? -1 : 1, // 머리가 보는 방향: -1 왼쪽, +1 오른쪽
    };
  }

  /** 색이 한쪽으로 쏠리지 않도록 bag 방식으로 뽑는다 */
  #takeColor() {
    if (!this.colorBag.length) {
      this.colorBag = PALETTE.map((_, i) => i + 1);
      for (let i = this.colorBag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.colorBag[i], this.colorBag[j]] = [this.colorBag[j], this.colorBag[i]];
      }
    }
    return this.colorBag.pop();
  }
}
