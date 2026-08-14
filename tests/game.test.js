import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DESIGN_MS, MAX_LEN, MIN_LEN } from '../src/config.js';
import { ACTION, Game, PHASE } from '../src/game/game.js';

/** 테스트에서 원하는 조각을 정확히 등장시킨다 */
function gameWith(piece, options) {
  const game = new Game(options);
  game.next = { ...piece };
  game.spawn();
  return game;
}

describe('Game', () => {
  it('설계 페이즈로 시작하고, 길이/방향이 규칙 범위 안이다', () => {
    const game = new Game();
    assert.equal(game.phase, PHASE.DESIGN);
    assert.equal(game.designLeft, DESIGN_MS);

    const lengths = new Set(), dirs = new Set();
    for (let i = 0; i < 200; i++) {
      game.reset();
      const len = game.snake.length;
      assert.ok(len >= MIN_LEN && len <= MAX_LEN, `길이 ${len}`);
      lengths.add(len);
      dirs.add(game.snake.facing[0]);
    }
    assert.ok(lengths.has(MIN_LEN) && lengths.has(MAX_LEN), '길이 양 끝값도 나온다');
    assert.deepEqual([...dirs].sort(), [-1, 1], '좌우 방향이 모두 나온다');
  });

  it('5초가 지나면 저절로 확정되어 낙하하고, 바닥에서 고정된 뒤 다음 조각이 나온다', () => {
    const game = gameWith({ len: 4, color: 1, dir: 1 });
    game.update(DESIGN_MS);
    assert.equal(game.phase, PHASE.FALL);

    for (let i = 0; i < 400 && game.placed === 0; i++) game.update(100);
    assert.equal(game.placed, 1);
    assert.equal(game.phase, PHASE.DESIGN, '다음 조각은 다시 설계부터');
    assert.ok(!game.board.isEmpty());
  });

  it('설계 중 SPACE는 확정만, 확정 후 SPACE가 하드드롭', () => {
    const game = gameWith({ len: 4, color: 1, dir: 1 });
    const shape = JSON.stringify(game.snake.cells);

    game.input(ACTION.SPACE);
    assert.equal(game.phase, PHASE.FALL);
    assert.equal(game.placed, 0, '확정만으로 고정되면 안 된다');
    assert.equal(JSON.stringify(game.snake.cells), shape, '확정이 위치를 바꾸면 안 된다');

    game.input(ACTION.SPACE);
    assert.equal(game.placed, 1);
    assert.ok(game.board.color[19].some(v => v), '바닥에 안착');
  });

  it('낙하 중에는 좌우 이동과 소프트드롭만 된다', () => {
    const game = gameWith({ len: 4, color: 1, dir: 1 });
    game.confirm();

    const before = game.snake.cells.map(([, c]) => c);
    game.input(ACTION.LEFT);
    assert.deepEqual(game.snake.cells.map(([, c]) => c), before.map(c => c - 1));

    game.input(ACTION.DOWN);
    assert.ok(game.snake.cells.some(([r]) => r === 1), '한 칸 내려간다');

    const shape = JSON.stringify(game.snake.cells);
    game.input(ACTION.UP);
    assert.equal(JSON.stringify(game.snake.cells), shape, '낙하 중에는 위로 못 간다');
  });

  it('설계 중 자기 몸에 부딪히면 바로 낙하가 시작된다', () => {
    const game = gameWith({ len: 5, color: 1, dir: 1 });
    game.input(ACTION.DOWN);
    game.input(ACTION.LEFT);
    game.input(ACTION.UP);
    assert.equal(game.phase, PHASE.FALL);
  });

  it('등장 자리가 막히면 게임 오버', () => {
    const game = new Game();
    for (let c = 0; c < 10; c++) game.board.color[0][c] = 1;
    game.spawn();
    assert.ok(game.over);
  });

  it('점수: 하드드롭 2점/칸, 삭제 10점/칸', () => {
    const game = gameWith({ len: 4, color: 1, dir: 1 });
    game.confirm();
    game.input(ACTION.SPACE);
    assert.equal(game.score, 19 * 2, '19칸 하드드롭');
  });

  it('덩어리가 터지면 onClear로 알린다', () => {
    const rounds = [];
    const game = gameWith({ len: 4, color: 2, dir: 1 }, { onClear: r => rounds.push(...r) });

    // 바닥 한 줄에서 6칸만 미리 채워두고, 남은 4칸을 이번 조각으로 메운다
    for (let c = 0; c < 6; c++) { game.board.color[19][c] = 2; game.board.pieceId[19][c] = 99; }
    game.confirm();
    while (game.snake.cells.some(([, c]) => c !== 6 && c !== 7 && c !== 8 && c !== 9)) {
      const cols = game.snake.cells.map(([, c]) => c);
      game.input(Math.min(...cols) < 6 ? ACTION.RIGHT : ACTION.LEFT);
    }
    game.input(ACTION.SPACE);

    assert.equal(rounds.length, 1, '한 라운드 삭제');
    assert.equal(rounds[0].cells.length, 10);
    assert.equal(game.lines, 1);
    assert.ok(game.board.isEmpty(), '터진 뒤 필드가 빈다');
  });

  it('블록을 쌓을수록 낙하가 빨라진다', () => {
    const game = new Game();
    const start = game.dropInterval;
    game.placed = 100;
    assert.ok(game.dropInterval < start);
    game.placed = 100000;
    assert.equal(game.dropInterval, 90, '하한선');
  });
});
