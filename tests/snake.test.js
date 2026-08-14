import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ROWS } from '../src/config.js';
import { Board } from '../src/game/board.js';
import { Snake, TURN } from '../src/game/snake.js';

const key = ([r, c]) => `${r},${c}`;
const noOverlap = snake => new Set(snake.cells.map(key)).size === snake.cells.length;

describe('Snake', () => {
  describe('spawn', () => {
    for (const dir of [1, -1]) {
      it(`가로 일자로 나오고 머리는 ${dir > 0 ? '오른쪽' : '왼쪽'} 끝이다`, () => {
        const snake = Snake.spawn(5, 1, dir, 10, 1);
        assert.ok(snake.cells.every(([r]) => r === 1), '지정한 줄에 한 줄로 등장');
        const cols = snake.cells.map(([, c]) => c);
        assert.equal(Math.max(...cols) - Math.min(...cols), 4, '빈틈 없는 일자');
        assert.equal(snake.head[1], dir > 0 ? Math.max(...cols) : Math.min(...cols));
        assert.deepEqual(snake.facing, [dir, 0]);
      });
    }
  });

  describe('turn (설계 타임)', () => {
    it('몸통이 머리가 지나온 경로를 따라온다', () => {
      const board = new Board();
      const snake = Snake.spawn(5, 1, 1, 10);
      const head0 = snake.head.slice();

      assert.equal(snake.turn(0, 1, board), TURN.MOVED);
      assert.deepEqual(snake.head, [head0[0] + 1, head0[1]]);
      assert.deepEqual(snake.neck, head0, '목이 머리가 있던 자리로');
      assert.equal(snake.length, 5, '길이 유지');
      assert.ok(noOverlap(snake));
    });

    it('벽 쪽으로는 아무 일도 일어나지 않는다', () => {
      const board = new Board();
      const snake = Snake.spawn(4, 1, 1, 10);
      const before = JSON.stringify(snake.cells);
      assert.equal(snake.turn(0, -1, board), TURN.BLOCKED, '0행에서 위');
      assert.equal(JSON.stringify(snake.cells), before);
    });

    it('쌓인 블록 쪽으로도 막힌다', () => {
      const board = new Board();
      const snake = Snake.spawn(4, 1, 1, 10);
      const [hr, hc] = snake.head;
      board.color[hr + 1][hc] = 2;
      assert.equal(snake.turn(0, 1, board), TURN.BLOCKED);
    });

    it('뒤로 가기는 페널티가 아니라 무시다', () => {
      const board = new Board();
      const snake = Snake.spawn(5, 1, 1, 10);
      const before = JSON.stringify(snake.cells);
      assert.equal(snake.turn(-1, 0, board), TURN.BLOCKED);
      assert.equal(JSON.stringify(snake.cells), before, '모양도 그대로');
      assert.equal(snake.turn(0, 1, board), TURN.MOVED, '이후 정상 진행');
    });

    it('목이 아닌 자기 몸에 부딪히면 페널티다', () => {
      const board = new Board();
      const snake = Snake.spawn(5, 1, 1, 10);
      assert.equal(snake.turn(0, 1, board), TURN.MOVED);   // 아래
      assert.equal(snake.turn(-1, 0, board), TURN.MOVED);  // 왼쪽
      assert.equal(snake.turn(0, -1, board), TURN.SELF_HIT, '원래 몸통 줄로 복귀');
    });

    it('바닥까지 내려간 뒤 계속 눌러도 모양이 망가지지 않는다', () => {
      const board = new Board();
      const snake = Snake.spawn(4, 1, 1, 10);
      for (let i = 0; i < 30; i++) snake.turn(0, 1, board);
      assert.equal(snake.head[0], ROWS - 1);
      assert.ok(noOverlap(snake));
    });
  });

  it('dropDistance는 바닥까지 남은 칸 수다', () => {
    const board = new Board();
    const snake = Snake.spawn(4, 1, 1, 10);
    assert.equal(snake.dropDistance(board), ROWS - 1);
    board.color[10][snake.head[1]] = 1;
    assert.equal(snake.dropDistance(board), 9);
  });
});
