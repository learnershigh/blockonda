import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Board } from '../src/game/board.js';
import { resolveClears } from '../src/game/clear.js';

const fill = (board, r, color, id = 1) => {
  for (let c = 0; c < board.cols; c++) { board.color[r][c] = color; board.pieceId[r][c] = id; }
};
const totalPoints = rounds => rounds.reduce((sum, r) => sum + r.points, 0);

describe('resolveClears', () => {
  it('벽~벽 한 줄이면 10칸 x 10점', () => {
    const board = new Board();
    fill(board, 19, 2);
    const rounds = resolveClears(board);
    assert.equal(rounds.length, 1);
    assert.equal(totalPoints(rounds), 100);
    assert.ok(board.isEmpty());
  });

  it('구불구불 11칸이면 110점이고, 위 블록은 덩어리째 내려온다', () => {
    const board = new Board();
    for (let c = 0; c <= 4; c++) { board.color[19][c] = 1; board.pieceId[19][c] = 1; }
    for (let c = 4; c <= 9; c++) { board.color[18][c] = 1; board.pieceId[18][c] = 1; }
    board.color[17][9] = 2; board.pieceId[17][9] = 2;

    const rounds = resolveClears(board);
    assert.equal(totalPoints(rounds), 110);
    assert.equal(board.color[19][9], 2, '남은 블록이 바닥까지 내려온다');
    assert.equal(board.color[17][9], 0);
  });

  it('터질 게 없으면 아무 일도 없다', () => {
    const board = new Board();
    [1, 2, 1, 2, 1, 2, 1, 2, 1, 2].forEach((color, c) => { board.color[19][c] = color; });
    assert.deepEqual(resolveClears(board), []);
  });

  it('낙하로 새 연결이 생기면 연쇄 배율이 붙는다', () => {
    const board = new Board();
    fill(board, 19, 1, 1);
    for (let c = 0; c <= 9; c++) if (c !== 5) { board.color[18][c] = 2; board.pieceId[18][c] = 2; }
    board.color[17][5] = 2; board.pieceId[17][5] = 2;

    const rounds = resolveClears(board);
    assert.equal(rounds.length, 2, '두 번에 걸쳐 터진다');
    assert.equal(rounds[0].points, 100);
    assert.equal(rounds[1].points, 200, '두 번째는 x2');
    assert.ok(board.isEmpty());
  });

  it('지워진 칸의 색과 머리 정보를 연출용으로 남긴다', () => {
    const board = new Board();
    fill(board, 19, 3);
    board.head[19][9] = 2;
    const [round] = resolveClears(board);
    assert.equal(round.cells.length, 10);
    assert.ok(round.cells.every(cell => cell.color === 3));
    assert.equal(round.cells.filter(cell => cell.head).length, 1);
  });
});
