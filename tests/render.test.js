import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createStubContext, stubImages } from './helpers/canvas-stub.js';

stubImages(); // assets.js가 Image를 쓰기 전에 준비

const { loadSprites } = await import('../src/assets.js');
const { CELL, ROWS } = await import('../src/config.js');
const { Game, ACTION } = await import('../src/game/game.js');
const { Effects } = await import('../src/render/effects.js');
const { drawBoard, drawPreview } = await import('../src/render/renderer.js');
const { drawSegment } = await import('../src/render/sprites.js');
const { LINK } = await import('../src/game/dirs.js');

const heads = draws => draws.filter(d => /Snake_Head/.test(d.src));
const bodies = draws => draws.filter(d => /Snake_Body\d/.test(d.src));
const corners = draws => draws.filter(d => /Snake_BodyCorner/.test(d.src));

describe('렌더링', () => {
  let ctx;
  before(() => loadSprites());
  beforeEach(() => { ctx = createStubContext(); });

  describe('스프라이트 방향', () => {
    const cases = [
      [[-1, 0], '왼쪽 (원본 그대로)'],
      [[1, 0], '오른쪽 (좌우반전)'],
      [[0, -1], '위 (회전)'],
      [[0, 1], '아래 (회전)'],
    ];
    for (const [facing, label] of cases) {
      it(`머리가 ${label}을 본다`, () => {
        drawSegment(ctx, 0, 0, CELL, 1, { head: facing });
        const [draw] = ctx.draws;
        assert.match(draw.src, /Snake_Head00\.png$/);
        assert.deepEqual(draw.nose, facing, '코가 향하는 방향');
        assert.deepEqual([draw.x, draw.y], [CELL / 2, CELL / 2], '칸 중앙에 그린다');
        assert.deepEqual(draw.mapDir([1, 0]), facing.map(v => -v || 0), '몸통은 반대쪽으로 이어진다');
      });
    }

    it('몸통 칸은 색에 맞는 몸통 스프라이트를 쓴다', () => {
      drawSegment(ctx, 0, 0, CELL, 3, { links: LINK.LEFT | LINK.RIGHT });
      assert.match(ctx.draws[0].src, /Snake_Body02\.png$/);
    });
  });

  describe('몸통 방향', () => {
    it('좌우로 이어지면 원본 그대로 (가로 세그먼트)', () => {
      drawSegment(ctx, 0, 0, CELL, 1, { links: LINK.LEFT | LINK.RIGHT });
      const [draw] = ctx.draws;
      assert.match(draw.src, /Snake_Body00\.png$/);
      assert.deepEqual(draw.mapDir([-1, 0]), [-1, 0], '열린 쪽이 좌우 그대로');
    });

    it('위아래로 이어지면 세로로 눕힌다', () => {
      drawSegment(ctx, 0, 0, CELL, 1, { links: LINK.UP | LINK.DOWN });
      const [draw] = ctx.draws;
      assert.match(draw.src, /Snake_Body00\.png$/);
      const opening = draw.mapDir([-1, 0]);
      assert.equal(opening[0], 0, '열린 쪽이 세로를 향한다');
      assert.equal(Math.abs(opening[1]), 1);
    });

    it('꼬리처럼 한쪽만 이어져도 그 축에 맞춘다', () => {
      drawSegment(ctx, 0, 0, CELL, 1, { links: LINK.UP });
      assert.equal(ctx.draws[0].mapDir([-1, 0])[0], 0, '세로');
    });
  });

  describe('코너', () => {
    // 원본 코너는 왼쪽 ↔ 아래로 이어져 있다. 나머지는 회전으로 만든다.
    const cases = [
      [LINK.LEFT | LINK.DOWN, [[-1, 0], [0, 1]], '왼쪽-아래'],
      [LINK.UP | LINK.LEFT, [[0, -1], [-1, 0]], '위-왼쪽'],
      [LINK.RIGHT | LINK.UP, [[1, 0], [0, -1]], '오른쪽-위'],
      [LINK.DOWN | LINK.RIGHT, [[0, 1], [1, 0]], '아래-오른쪽'],
    ];
    for (const [links, expected, label] of cases) {
      it(`${label}으로 꺾인 칸은 코너를 그 방향으로 돌려 그린다`, () => {
        drawSegment(ctx, 0, 0, CELL, 2, { links });
        const [draw] = ctx.draws;
        assert.match(draw.src, /Snake_BodyCorner01\.png$/);
        // 원본이 열려 있는 두 방향(왼쪽, 아래)이 화면에서 어디를 향하는지
        const openings = [draw.mapDir([-1, 0]), draw.mapDir([0, 1])];
        assert.deepEqual(new Set(openings.map(String)), new Set(expected.map(String)));
      });
    }
  });

  describe('NEXT 미리보기', () => {
    for (const dir of [1, -1]) {
      it(`머리가 ${dir > 0 ? '오른' : '왼'}쪽 끝에서 그 방향을 본다`, () => {
        drawPreview(ctx, { len: 5, color: 2, dir });
        assert.equal(heads(ctx.draws).length, 1);
        assert.equal(bodies(ctx.draws).length, 4);

        const head = heads(ctx.draws)[0];
        assert.equal(head.nose[0], dir);
        const xs = ctx.draws.map(d => d.x);
        assert.equal(head.x, dir > 0 ? Math.max(...xs) : Math.min(...xs));
      });
    }
  });

  describe('섀도우', () => {
    it('착지 위치에 흐리게, 같은 방향으로 그려진다', () => {
      const game = new Game();
      game.next = { len: 5, color: 1, dir: 1 };
      game.spawn();
      drawBoard(ctx, game, null);

      const ghosts = ctx.draws.filter(d => d.alpha < 1);
      const solid = ctx.draws.filter(d => d.alpha === 1);
      assert.equal(ghosts.length, 5);
      assert.equal(solid.length, 5);

      const ghostHead = heads(ghosts)[0], liveHead = heads(solid)[0];
      assert.equal(ghostHead.y - liveHead.y, game.snake.dropDistance(game.board) * CELL);
      assert.equal(ghostHead.x, liveHead.x);
      assert.deepEqual(ghostHead.nose, liveHead.nose);
    });

    it('머리 방향을 꺾으면 섀도우도 따라 돈다', () => {
      const game = new Game();
      game.next = { len: 5, color: 1, dir: 1 };
      game.spawn();
      game.input(ACTION.DOWN);

      drawBoard(ctx, game, null);
      const ghostHead = heads(ctx.draws.filter(d => d.alpha < 1))[0];
      assert.deepEqual(ghostHead.nose, [0, 1]);
    });
  });

  describe('실제 뱀', () => {
    it('설계로 꺾은 자리에 코너가 그려진다', () => {
      const game = new Game();
      game.next = { len: 4, color: 1, dir: 1 };
      game.spawn();
      game.input(ACTION.DOWN); // 머리를 아래로 꺾는다

      drawBoard(ctx, game, null);
      const solid = ctx.draws.filter(d => d.alpha === 1);
      assert.equal(corners(solid).length, 1, '꺾인 칸 하나가 코너');
      assert.equal(heads(solid).length, 1);
      assert.equal(bodies(solid).length, 2);
    });

    it('꺾지 않으면 코너가 없다', () => {
      const game = new Game();
      game.next = { len: 4, color: 1, dir: 1 };
      game.spawn();
      drawBoard(ctx, game, null);
      assert.equal(corners(ctx.draws).length, 0);
    });
  });

  describe('쌓인 블록', () => {
    it('고정된 조각의 머리 칸은 머리 스프라이트로 남는다', () => {
      const game = new Game();
      game.next = { len: 4, color: 1, dir: 1 };
      game.spawn();
      game.confirm();
      game.input(ACTION.SPACE);

      drawBoard(ctx, game, null);
      const stackHeads = heads(ctx.draws.filter(d => d.alpha === 1 && d.y > (ROWS - 1) * CELL));
      assert.equal(stackHeads.length, 1);
      assert.deepEqual(stackHeads[0].nose, [1, 0]);
    });
  });
});

describe('삭제 이펙트', () => {
  const round = (chain = 1) => ({
    chain, groups: 1, points: 100,
    cells: Array.from({ length: 10 }, (_, c) => ({ r: ROWS - 1, c, color: 2, head: c === 9 ? 2 : 0 })),
  });

  it('칸마다 디졸브 조각과 줄 섬광, 흔들림/히트스톱이 생긴다', () => {
    const fx = new Effects();
    fx.spawn([round()]);
    assert.equal(fx.cells.length, 10);
    assert.equal(fx.rows.length, 1);
    assert.ok(fx.shake > 0 && fx.hitstop > 0);
    assert.ok(fx.frozen, 'hitstop 동안 게임 시간이 멈춘다');
    assert.ok(fx.cells.some(c => c.head), '머리 칸도 기억한다');
    assert.ok(fx.cells.every(c => c.seed.length === 16));
  });

  it('연쇄일수록 더 세게 때린다', () => {
    const single = new Effects();
    single.spawn([round(1)]);
    const chained = new Effects();
    chained.spawn([round(3)]);
    assert.ok(chained.shake > single.shake);
    assert.ok(chained.hitstop > single.hitstop);
  });

  it('시간이 지나면 정리되고 흔들림도 잦아든다', () => {
    const fx = new Effects();
    fx.spawn([round()]);
    for (let i = 0; i < 20; i++) fx.update(60);
    assert.equal(fx.cells.length, 0);
    assert.equal(fx.rows.length, 0);
    assert.equal(fx.shake, 0);
    assert.ok(!fx.frozen);
  });

  it('디졸브 조각이 실제로 그려진다', () => {
    const ctx = createStubContext();
    const fx = new Effects();
    fx.spawn([round()]);
    fx.draw(ctx);
    assert.ok(ctx.draws.length > 10, '칸당 여러 조각');
    assert.ok(ctx.draws.every(d => d.alpha <= 1));
  });
});
