import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Board } from '../src/game/board.js';

/** 테스트용으로 칸을 직접 채운다 */
function put(board, r, c, color, id, head = 0) {
  board.color[r][c] = color;
  board.pieceId[r][c] = id;
  board.head[r][c] = head;
}

describe('Board', () => {
  it('조각을 고정하면 머리 칸에 방향이 기록된다', () => {
    const board = new Board();
    const id = board.lock([[19, 5], [19, 4], [19, 3]], 2, 2);
    assert.equal(board.color[19][5], 2);
    assert.equal(board.pieceId[19][3], id);
    assert.equal(board.head[19][5], 2, '머리 칸');
    assert.equal(board.head[19][4], 0, '몸통 칸');
  });

  describe('findSpanning', () => {
    it('좌우 벽에 닿은 같은 색 직선을 찾는다', () => {
      const board = new Board();
      for (let c = 0; c < 10; c++) put(board, 19, c, 2, 1);
      assert.equal(board.findSpanning().length, 1);
    });

    it('구불구불해도 이어져 있으면 찾는다', () => {
      const board = new Board();
      for (let c = 0; c <= 4; c++) put(board, 19, c, 1, 1);
      for (let c = 4; c <= 9; c++) put(board, 18, c, 1, 1);
      const comps = board.findSpanning();
      assert.equal(comps.length, 1);
      assert.equal(comps[0].length, 11);
    });

    it('대각선으로만 닿은 건 이어진 게 아니다', () => {
      const board = new Board();
      for (let c = 0; c <= 4; c++) put(board, 19, c, 1, 1);
      for (let c = 5; c <= 9; c++) put(board, 18, c, 1, 1);
      assert.equal(board.findSpanning().length, 0);
    });

    it('꽉 찼어도 색이 섞였으면 아니다', () => {
      const board = new Board();
      [1, 2, 1, 2, 1, 2, 1, 2, 1, 2].forEach((color, c) => put(board, 19, c, color, 1));
      assert.equal(board.findSpanning().length, 0);
    });

    it('같은 색이어도 한 칸 비면 아니다', () => {
      const board = new Board();
      for (let c = 0; c < 10; c++) if (c !== 4) put(board, 19, c, 3, 1);
      assert.equal(board.findSpanning().length, 0);
    });
  });

  describe('applyGravity (덩어리 강체 낙하)', () => {
    it('한쪽만 받쳐진 조각은 빈칸 위에 걸친 채 모양을 유지한다', () => {
      const board = new Board();
      put(board, 19, 0, 1, 100);          // 바닥 지지대
      put(board, 18, 0, 2, 101);
      put(board, 18, 1, 2, 101);          // 같은 조각의 가로 바
      board.applyGravity();
      assert.equal(board.color[18][1], 2, '조각이 부서지면 안 된다');
      assert.equal(board.color[19][1], 0, '아래 빈칸을 메우면 안 된다');
    });

    it('삭제로 두 동강 난 조각은 각각 따로 떨어진다', () => {
      const board = new Board();
      put(board, 15, 3, 1, 200);
      put(board, 15, 5, 1, 200);          // 같은 id지만 이어져 있지 않다
      board.applyGravity();
      assert.equal(board.color[19][3], 1);
      assert.equal(board.color[19][5], 1);
      assert.equal(board.color[15][3], 0);
    });

    it('L자 덩어리가 모양 그대로 내려온다', () => {
      const board = new Board();
      put(board, 10, 2, 2, 300);
      put(board, 11, 2, 2, 300);
      put(board, 11, 3, 2, 300);
      board.applyGravity();
      assert.equal(board.color[18][2], 2);
      assert.equal(board.color[19][2], 2);
      assert.equal(board.color[19][3], 2);
    });

    it('머리 정보가 낙하 후에도 따라온다', () => {
      const board = new Board();
      put(board, 10, 4, 1, 400, 2);
      put(board, 10, 5, 1, 400, 0);
      board.applyGravity();
      assert.equal(board.head[19][4], 2, '머리 방향 코드 유지');
      assert.equal(board.head[19][5], 0);
      assert.equal(board.head[10][4], 0, '원래 자리는 비어야 한다');
    });
  });
});
