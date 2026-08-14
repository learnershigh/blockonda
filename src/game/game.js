import { DESIGN_MS, MAX_LEN, MIN_LEN, PALETTE, SCORE, SPAWN_ROW, SPEED } from '../config.js';
import { Board } from './board.js';
import { resolveClears } from './clear.js';
import { dirCode } from './dirs.js';
import { Snake, TURN } from './snake.js';

export const PHASE = {
  DESIGN: 'design', // 5초 동안 방향키로 모양을 만드는 중
  FALL: 'fall',     // 모양이 확정되어 떨어지는 중
};

export const ACTION = {
  LEFT: 'left', RIGHT: 'right', UP: 'up', DOWN: 'down', SPACE: 'space',
};

/**
 * 게임 규칙 전체. 렌더링과 DOM을 전혀 모르며, 시간은 update(dt)로만 흐른다.
 * onClear 콜백으로 "무엇이 터졌는지"만 바깥에 알려주고 연출은 바깥에 맡긴다.
 */
export class Game {
  constructor({ rng = Math.random, onClear = null } = {}) {
    this.rng = rng;
    this.onClear = onClear;
    this.board = new Board();
    this.reset();
  }

  reset() {
    this.board.clear();
    this.score = 0;
    this.lines = 0;      // 터뜨린 덩어리 수
    this.placed = 0;     // 쌓은 블록 수 (낙하 속도의 기준)
    this.over = false;
    this.colorBag = [];
    this.next = this.#randomPiece();
    this.spawn();
  }

  spawn() {
    const { len, color, dir } = this.next;
    this.snake = Snake.spawn(len, color, dir, this.board.cols, SPAWN_ROW);
    this.next = this.#randomPiece();
    this.phase = PHASE.DESIGN;
    this.designLeft = DESIGN_MS;
    this.acc = 0;
    if (this.snake.collides(this.board)) this.over = true; // 등장 자리가 이미 막힘
  }

  /** 설계를 끝내고 낙하 시작 */
  confirm() {
    this.phase = PHASE.FALL;
    this.acc = 0;
  }

  input(action) {
    if (this.over) return;
    if (this.phase === PHASE.DESIGN) return this.#designInput(action);
    return this.#fallInput(action);
  }

  update(dt) {
    if (this.over) return;
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

  get dropInterval() {
    return Math.max(SPEED.min, SPEED.base - Math.floor(this.placed / SPEED.per) * SPEED.step);
  }

  /** 설계 타임 남은 시간(초, 표시용) */
  get designSeconds() { return Math.max(0, this.designLeft) / 1000; }

  #designInput(action) {
    const turn = {
      [ACTION.LEFT]: [-1, 0], [ACTION.RIGHT]: [1, 0],
      [ACTION.UP]: [0, -1], [ACTION.DOWN]: [0, 1],
    }[action];
    if (turn) {
      // 자기 몸에 부딪히면 페널티로 그 모양 그대로 굳는다
      if (this.snake.turn(turn[0], turn[1], this.board) === TURN.SELF_HIT) this.confirm();
      return;
    }
    if (action === ACTION.SPACE) this.confirm();
  }

  #fallInput(action) {
    switch (action) {
      case ACTION.LEFT:
      case ACTION.RIGHT: {
        const dc = action === ACTION.LEFT ? -1 : 1;
        if (this.snake.canShift(this.board, 0, dc)) this.snake.shift(0, dc);
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
    while (this.snake.canShift(this.board, 1, 0)) {
      this.snake.shift(1, 0);
      this.score += SCORE.hard;
    }
    this.#lock();
  }

  #gravityStep() {
    if (this.snake.canShift(this.board, 1, 0)) this.snake.shift(1, 0);
    else this.#lock();
  }

  #lock() {
    const [dx, dy] = this.snake.facing;
    this.board.lock(this.snake.cells, this.snake.color, dirCode(dx, dy));
    this.placed++;

    const rounds = resolveClears(this.board);
    for (const round of rounds) {
      this.score += round.points;
      this.lines += round.groups;
    }
    if (rounds.length && this.onClear) this.onClear(rounds);

    if (!this.over) this.spawn();
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
