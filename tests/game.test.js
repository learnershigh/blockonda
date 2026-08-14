import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_LEN, MIN_LEN, PACE, ROWS, SPAWN_ROW } from '../src/config.js';
import { ACTION, EVENT, Game, PHASE } from '../src/game/game.js';

const FLOOR = ROWS - 1;

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
    assert.equal(game.designLeft, PACE.designMax, '0점에서는 가장 넉넉하게');
    assert.ok(game.snake.cells.every(([r]) => r === SPAWN_ROW), '위에서 한 칸 떨어져 등장');

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

  it('설계 시간이 다 되면 저절로 확정되어 낙하하고, 바닥에서 고정된 뒤 다음 조각이 나온다', () => {
    const game = gameWith({ len: 4, color: 1, dir: 1 });
    game.update(game.designTime);
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
    assert.ok(game.board.color[FLOOR].some(v => v), '바닥에 안착');
  });

  it('낙하 중에는 좌우 이동과 소프트드롭만 된다', () => {
    const game = gameWith({ len: 4, color: 1, dir: 1 });
    game.confirm();

    const before = game.snake.cells.map(([, c]) => c);
    game.input(ACTION.LEFT);
    assert.deepEqual(game.snake.cells.map(([, c]) => c), before.map(c => c - 1));

    game.input(ACTION.DOWN);
    assert.ok(game.snake.cells.some(([r]) => r === SPAWN_ROW + 1), '한 칸 내려간다');

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
    for (let c = 0; c < 10; c++) game.board.color[SPAWN_ROW][c] = 1;
    game.spawn();
    assert.ok(game.over);
  });

  it('점수: 하드드롭 2점/칸', () => {
    const game = gameWith({ len: 4, color: 1, dir: 1 });
    game.confirm();
    game.input(ACTION.SPACE);
    assert.equal(game.score, (FLOOR - SPAWN_ROW) * 2);
  });

  it('덩어리가 터지면 clear 이벤트로 알리고, 연쇄가 끝날 때까지 다음 조각을 기다린다', () => {
    const rounds = [];
    const game = gameWith({ len: 4, color: 2, dir: 1 },
      { onEvent: (type, data) => { if (type === EVENT.CLEAR) rounds.push(data); } });

    // 바닥 한 줄에서 6칸만 미리 채워두고, 남은 4칸을 이번 조각으로 메운다
    for (let c = 0; c < 6; c++) { game.board.color[FLOOR][c] = 2; game.board.pieceId[FLOOR][c] = 99; }
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

    assert.equal(game.phase, PHASE.CLEAR, '연출이 끝날 때까지는 조작할 조각이 없다');
    game.input(ACTION.SPACE); // 이 동안의 입력은 무시된다
    assert.equal(game.phase, PHASE.CLEAR);

    for (let i = 0; i < 100 && game.phase === PHASE.CLEAR; i++) game.update(20);
    assert.equal(game.phase, PHASE.DESIGN, '연쇄가 끝나면 다음 조각이 등장한다');
  });

  it('착지하면 land 이벤트로 부딪힌 면과 하드드롭 거리를 알린다', () => {
    const hits = [];
    const game = gameWith({ len: 4, color: 3, dir: 1 },
      { onEvent: (type, data) => { if (type === EVENT.LAND) hits.push(data); } });
    game.confirm();
    game.input(ACTION.DOWN); // 아직 바닥이 아니라 착지가 아니다
    assert.equal(hits.length, 0);

    game.input(ACTION.SPACE);
    assert.equal(hits.length, 1);
    const [hit] = hits;
    assert.equal(hit.distance, FLOOR - SPAWN_ROW - 1, '소프트드롭으로 내려온 한 칸은 빠진다');
    assert.equal(hit.cells.length, 4, '가로 일자는 네 칸 모두가 충격면');
    assert.ok(hit.cells.every(([r]) => r === FLOOR), '충격면은 바닥에 닿은 줄');
  });

  it('저절로 닿아 굳어도 land 이벤트는 나오고, 거리는 0이다', () => {
    const hits = [];
    const game = gameWith({ len: 4, color: 1, dir: 1 },
      { onEvent: (type, data) => { if (type === EVENT.LAND) hits.push(data); } });
    game.confirm();
    while (!game.placed) game.update(1000); // 중력에 맡겨 바닥까지
    assert.equal(hits.length, 1);
    assert.equal(hits[0].distance, 0, '하드드롭이 아니면 착지 충격도 없다');
  });

  it('생성 / 머리 이동 / 몸통박치기 / 게임오버를 이벤트로 알린다', () => {
    const seen = [];
    const game = gameWith({ len: 4, color: 1, dir: 1 }, { onEvent: type => seen.push(type) });
    assert.ok(seen.every(type => type === EVENT.SPAWN), '등장할 때마다 spawn');
    seen.length = 0;

    game.input(ACTION.UP);
    assert.deepEqual(seen, [EVENT.MOVE]);
    game.input(ACTION.LEFT);   // 벽이 아니라 이동 성공
    game.input(ACTION.DOWN);   // 머리가 방금 지나온 자리 = 자기 몸
    assert.deepEqual(seen, [EVENT.MOVE, EVENT.MOVE, EVENT.SELF_HIT]);
    assert.equal(game.phase, PHASE.FALL, '몸통박치기는 그 자리에서 굳는다');

    seen.length = 0;
    game.input(ACTION.SPACE);  // 착지 → 새 조각 등장
    assert.deepEqual(seen, [EVENT.LAND, EVENT.SPAWN]);

    seen.length = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < 10; c++) game.board.color[r][c] = 1;
    game.spawn();              // 등장 자리가 막혔다
    assert.deepEqual(seen, [EVENT.OVER]);
    assert.ok(game.over);
  });

  describe('콤보', () => {
    /** 바닥 왼쪽 6칸을 미리 채워두고, 이번 조각으로 오른쪽 4칸을 메워 한 줄을 터뜨린다 */
    function clearOnce(game, color) {
      game.next = { len: 4, color, dir: 1 };
      game.spawn();
      for (let c = 0; c < 6; c++) { game.board.color[FLOOR][c] = color; game.board.pieceId[FLOOR][c] = 99; }
      game.confirm();
      while (game.snake.cells.some(([, c]) => c < 6)) game.input(ACTION.RIGHT);
      game.input(ACTION.SPACE);
      for (let i = 0; i < 100 && game.phase === PHASE.CLEAR; i++) game.update(20);
    }

    it('조각이 바뀌어도 계속 터뜨리는 동안은 콤보가 이어진다', () => {
      const combos = [];
      const game = new Game({ onEvent: (type, data) => { if (type === EVENT.CLEAR) combos.push(data.combo); } });

      clearOnce(game, 2);
      assert.equal(game.combo, 1);
      clearOnce(game, 2);
      assert.equal(game.combo, 2, '다음 조각으로 또 터뜨리면 이어진다');
      clearOnce(game, 3);
      assert.deepEqual(combos, [1, 2, 3], 'clear 이벤트가 지금 콤보를 함께 알린다');
    });

    it('아무것도 못 터뜨린 조각이 굳으면 콤보가 끊긴다', () => {
      const game = new Game();
      clearOnce(game, 2);
      assert.equal(game.combo, 1);

      game.next = { len: 4, color: 1, dir: 1 };
      game.spawn();
      game.confirm();
      game.input(ACTION.SPACE); // 빈 바닥에 그냥 쌓이기만 한다
      assert.equal(game.combo, 0);
      assert.equal(game.phase, PHASE.DESIGN, '터진 게 없으니 곧장 다음 조각');
    });

    it('한 조각 안의 연쇄도 라운드마다 콤보를 올린다', () => {
      const rounds = [];
      const game = gameWith({ len: 4, color: 3, dir: 1 },
        { onEvent: (type, data) => { if (type === EVENT.CLEAR) rounds.push(data); } });

      // 바닥 한 줄(빨강)이 터지면 그 위 조각들이 내려앉으며 두 번째 줄(초록)이 완성된다
      for (let c = 0; c < 10; c++) { game.board.color[FLOOR][c] = 1; game.board.pieceId[FLOOR][c] = 99; }
      for (let c = 0; c < 10; c++) {
        if (c === 5) continue;
        game.board.color[FLOOR - 1][c] = 2;
        game.board.pieceId[FLOOR - 1][c] = 98;
      }
      game.board.color[FLOOR - 2][5] = 2; // 빈 자리로 내려앉아 줄을 잇는 한 칸
      game.board.pieceId[FLOOR - 2][5] = 97;

      game.confirm();
      game.input(ACTION.SPACE); // 얹히기만 해도 판정은 시작된다
      for (let i = 0; i < 200 && game.phase === PHASE.CLEAR; i++) game.update(20);

      assert.deepEqual(rounds.map(r => r.chain), [1, 2], '두 번에 걸쳐 터진다');
      assert.deepEqual(rounds.map(r => r.combo), [1, 2], '연쇄 라운드마다 콤보도 오른다');
      assert.equal(game.combo, 2);
    });

    it('reset하면 콤보도 처음으로 돌아간다', () => {
      const game = new Game();
      clearOnce(game, 2);
      assert.equal(game.combo, 1);
      game.reset();
      assert.equal(game.combo, 0);
    });
  });

  describe('점수에 따른 난이도', () => {
    it('설계 시간과 낙하 간격이 점수를 따라 함께 조여진다', () => {
      const game = new Game();
      assert.equal(game.designTime, PACE.designMax);
      assert.equal(game.dropInterval, PACE.dropMax);

      game.score = PACE.full / 2;
      assert.equal(game.pace, 0.5);
      assert.equal(game.designTime, (PACE.designMax + PACE.designMin) / 2, '딱 중간');
      assert.equal(game.dropInterval, (PACE.dropMax + PACE.dropMin) / 2);

      game.score = PACE.full;
      assert.equal(game.designTime, PACE.designMin);
      assert.equal(game.dropInterval, PACE.dropMin);
    });

    it('최고 난이도에서 더 조여지지는 않는다', () => {
      const game = new Game();
      game.score = PACE.full * 100;
      assert.equal(game.pace, 1);
      assert.equal(game.designTime, PACE.designMin, '3초가 하한');
      assert.equal(game.dropInterval, PACE.dropMin);
    });

    it('설계 시간은 조각이 나온 시점의 점수로 정해진다', () => {
      const game = gameWith({ len: 4, color: 1, dir: 1 });
      assert.equal(game.designLeft, PACE.designMax);

      game.score = PACE.full;      // 점수를 벌었어도 이번 조각의 시간은 그대로
      assert.equal(game.designLeft, PACE.designMax, '진행 중인 설계를 중간에 깎지 않는다');

      game.spawn();                // 다음 조각부터 짧아진다
      assert.equal(game.designLeft, PACE.designMin);
    });
  });
});
