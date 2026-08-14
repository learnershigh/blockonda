import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CASCADE } from '../src/config.js';
import { Board } from '../src/game/board.js';
import { Cascade } from '../src/game/clear.js';

const put = (board, r, c, color, id = 1) => {
  board.color[r][c] = color;
  board.pieceId[r][c] = id;
};
const fillRow = (board, r, color, id = 1) => {
  for (let c = 0; c < board.cols; c++) put(board, r, c, color, id);
};
const totalPoints = rounds => rounds.reduce((sum, r) => sum + r.points, 0);

/** 연쇄가 끝날 때까지 시간을 흘려보내며 라운드를 모은다 */
function runAll(board, dt = 20) {
  const cascade = new Cascade(board);
  const rounds = [];
  for (let round = cascade.pop(); round; round = cascade.pop()) {
    rounds.push(round);
    while (cascade.step(dt));
  }
  return rounds;
}

describe('Cascade (삭제 + 연쇄)', () => {
  it('벽~벽 한 줄이면 10칸 x 10점', () => {
    const board = new Board();
    fillRow(board, board.rows - 1, 2);
    const rounds = runAll(board);
    assert.equal(rounds.length, 1);
    assert.equal(totalPoints(rounds), 100);
    assert.ok(board.isEmpty());
  });

  it('구불구불 11칸이면 110점이고, 위 블록은 덩어리째 내려온다', () => {
    const board = new Board();
    const floor = board.rows - 1;
    for (let c = 0; c <= 4; c++) put(board, floor, c, 1);
    for (let c = 4; c <= 9; c++) put(board, floor - 1, c, 1);
    put(board, floor - 2, 9, 2, 2);

    const rounds = runAll(board);
    assert.equal(totalPoints(rounds), 110);
    assert.equal(board.color[floor][9], 2, '남은 블록이 바닥까지 내려온다');
    assert.equal(board.color[floor - 2][9], 0);
  });

  it('터질 게 없으면 아무 일도 없다', () => {
    const board = new Board();
    [1, 2, 1, 2, 1, 2, 1, 2, 1, 2].forEach((color, c) => put(board, board.rows - 1, c, color));
    assert.deepEqual(runAll(board), []);
  });

  it('낙하로 새 연결이 생기면 연쇄 배율이 붙는다', () => {
    const board = new Board();
    const floor = board.rows - 1;
    fillRow(board, floor, 1, 1);
    for (let c = 0; c <= 9; c++) if (c !== 5) put(board, floor - 1, c, 2, 2);
    put(board, floor - 2, 5, 2, 2);

    const rounds = runAll(board);
    assert.equal(rounds.length, 2, '두 번에 걸쳐 터진다');
    assert.equal(rounds[0].points, 100);
    assert.equal(rounds[1].points, 200, '두 번째는 x2');
    assert.ok(board.isEmpty());
  });

  it('지워진 칸의 색과 머리 정보를 연출용으로 남긴다', () => {
    const board = new Board();
    const floor = board.rows - 1;
    fillRow(board, floor, 3);
    board.head[floor][9] = 2;
    const [round] = runAll(board);
    assert.equal(round.cells.length, 10);
    assert.ok(round.cells.every(cell => cell.color === 3));
    assert.equal(round.cells.filter(cell => cell.head).length, 1);
  });

  it('터진 직후에는 남은 블록이 아직 떠 있고, 시간이 지나야 한 칸씩 내려온다', () => {
    const board = new Board();
    const floor = board.rows - 1;
    fillRow(board, floor, 1, 1);
    put(board, floor - 3, 0, 2, 2); // 세 칸 위에 떠 있게 될 블록

    const cascade = new Cascade(board);
    cascade.pop();
    assert.equal(board.color[floor - 3][0], 2, '터지자마자 떨어지지는 않는다');

    cascade.step(CASCADE.popMs - 1);
    assert.equal(board.color[floor - 3][0], 2, '아직 그 자리');
    cascade.step(1);
    assert.equal(board.color[floor - 2][0], 2, 'popMs이 지나야 한 칸만 내려온다');
    cascade.step(CASCADE.fallMs);
    assert.equal(board.color[floor - 1][0], 2, '또 한 칸');

    while (cascade.step(CASCADE.fallMs));
    assert.equal(board.color[floor][0], 2, '결국 바닥까지');
  });

  it('다 내려앉은 뒤에도 한 박자 쉬고 나서 다음 연쇄를 판정한다', () => {
    const board = new Board();
    fillRow(board, board.rows - 1, 1);
    const cascade = new Cascade(board);
    cascade.pop();

    assert.ok(cascade.step(CASCADE.popMs), '터진 자리를 보여주는 동안');
    assert.ok(cascade.step(CASCADE.settleMs - 1), '자리잡은 모습을 보여주는 동안');
    assert.equal(cascade.step(1), false, '그제서야 다음 판정');
  });
});
