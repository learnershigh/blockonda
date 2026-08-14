import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createStubContext, stubImages } from './helpers/canvas-stub.js';

stubImages(); // assets.js가 Image를 쓰기 전에 준비

const { loadSprites } = await import('../src/assets.js');
const { CELL, COLS, COMBO, CONFIRM, FX, PENALTY, ROWS } = await import('../src/config.js');
const { Game, ACTION } = await import('../src/game/game.js');
const { Effects } = await import('../src/render/effects.js');
const { drawBoard, drawPreview } = await import('../src/render/renderer.js');
const { drawSegment } = await import('../src/render/sprites.js');
const { LINK } = await import('../src/game/dirs.js');

const heads = draws => draws.filter(d => /Snake_Head/.test(d.src));
const bodies = draws => draws.filter(d => /Snake_Body\d/.test(d.src));
const corners = draws => draws.filter(d => /Snake_BodyCorner/.test(d.src));
const tails = draws => draws.filter(d => /Snake_Tail/.test(d.src));

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

  describe('꼬리 방향', () => {
    const cases = [
      [[-1, 0], '왼쪽'], [[1, 0], '오른쪽'], [[0, -1], '위'], [[0, 1], '아래'],
    ];
    for (const [toward, label] of cases) {
      it(`몸통이 ${label}에 있으면 그쪽으로 이어 붙는다`, () => {
        drawSegment(ctx, 0, 0, CELL, 1, { tail: toward });
        const [draw] = ctx.draws;
        assert.match(draw.src, /Snake_Tail00\.png$/);
        // 원본 꼬리는 왼쪽이 이음새 — 그 면이 몸통 쪽을 향해야 한다
        assert.deepEqual(draw.mapDir([-1, 0]), toward);
        assert.deepEqual([draw.x, draw.y], [CELL / 2, CELL / 2]);
      });
    }
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
        assert.equal(bodies(ctx.draws).length, 3);
        assert.equal(tails(ctx.draws).length, 1);

        const head = heads(ctx.draws)[0];
        assert.equal(head.nose[0], dir);
        const xs = ctx.draws.map(d => d.x);
        assert.equal(head.x, dir > 0 ? Math.max(...xs) : Math.min(...xs));

        const tail = tails(ctx.draws)[0];
        assert.ok(tail, '반대쪽 끝은 꼬리');
        assert.equal(tail.x, dir > 0 ? Math.min(...xs) : Math.max(...xs));
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
      assert.equal(tails(solid).length, 1);
      assert.equal(bodies(solid).length, 1);
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
      const stack = ctx.draws.filter(d => d.alpha === 1 && d.y > (ROWS - 1) * CELL);
      assert.equal(heads(stack).length, 1);
      assert.deepEqual(heads(stack)[0].nose, [1, 0]);
      assert.equal(tails(stack).length, 1, '꼬리도 남는다');
      assert.deepEqual(tails(stack)[0].mapDir([-1, 0]), [1, 0], '꼬리는 몸통 쪽을 향한다');
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
    fx.spawn(round());
    assert.equal(fx.cells.length, 10);
    assert.equal(fx.rows.length, 1);
    assert.ok(fx.shake > 0 && fx.hitstop > 0);
    assert.ok(fx.frozen, 'hitstop 동안 게임 시간이 멈춘다');
    assert.ok(fx.cells.some(c => c.head), '머리 칸도 기억한다');
    assert.ok(fx.cells.every(c => c.seed.length === 16));
  });

  it('연쇄일수록 더 세게 때린다', () => {
    const single = new Effects();
    single.spawn(round(1));
    const chained = new Effects();
    chained.spawn(round(3));
    assert.ok(chained.shake > single.shake);
    assert.ok(chained.hitstop > single.hitstop);
  });

  it('시간이 지나면 정리되고 흔들림도 잦아든다', () => {
    const fx = new Effects();
    fx.spawn(round());
    for (let i = 0; i < 20; i++) fx.update(60);
    assert.equal(fx.cells.length, 0);
    assert.equal(fx.rows.length, 0);
    assert.equal(fx.shake, 0);
    assert.ok(!fx.frozen);
  });

  it('디졸브 조각이 실제로 그려진다', () => {
    const ctx = createStubContext();
    const fx = new Effects();
    fx.spawn(round());
    fx.draw(ctx);
    assert.ok(ctx.draws.length > 10, '칸당 여러 조각');
    assert.ok(ctx.draws.every(d => d.alpha <= 1));
  });
});

describe('콤보 표시', () => {
  const round = chain => ({
    chain, groups: 1, points: 100,
    cells: [{ r: ROWS - 1, c: 0, color: 2, head: 0 }],
  });
  /** 연쇄 한 라운드를 그려서 기록을 돌려준다 */
  const paint = chain => {
    const ctx = createStubContext();
    const fx = new Effects();
    fx.spawn(round(chain));
    fx.draw(ctx);
    return { fx, ctx, text: ctx.texts[0] };
  };
  const fontSize = text => +/(\d+)px/.exec(text.font)[1];

  it(`${COMBO.min}연쇄부터 "nCombo!"가 뜬다`, () => {
    const { text } = paint(COMBO.min);
    assert.ok(text, '팝업이 그려진다');
    assert.equal(text.text, `${COMBO.min}Combo!`);
    assert.equal(text.x, COLS * CELL / 2, '필드 가로 한가운데');
    assert.ok(text.y > 0 && text.y < ROWS * CELL, '필드 안에 뜬다');
    assert.ok(text.scale > 1, '나타나는 순간 크게 튄다');
  });

  it('연쇄 없이 한 번 터진 걸로는 뜨지 않는다', () => {
    const { fx, ctx } = paint(1);
    assert.equal(fx.combo, null, '조각마다 한 줄씩 지운 건 이어져도 콤보가 아니다');
    assert.deepEqual(ctx.texts, []);
  });

  it('조각이 바뀌면 연쇄가 처음부터 다시 세어져 콤보도 끊긴다', () => {
    const ctx = createStubContext();
    const fx = new Effects();
    // 한 조각이 2연쇄를 냈다가, 다음 조각은 연쇄 없이 한 번만 터뜨린 상황
    fx.spawn(round(1));
    fx.spawn(round(2));
    assert.equal(fx.combo.n, 2);

    fx.update(COMBO.showMs);
    fx.spawn(round(1)); // 다음 조각의 첫 삭제 — Cascade가 새로 만들어져 chain은 1부터
    fx.draw(ctx);
    assert.equal(fx.combo, null);
    assert.deepEqual(ctx.texts, []);
  });

  it('콤보가 쌓일수록 글자가 커지고 색이 뜨거워진다', () => {
    const low = paint(COMBO.min).text;
    const high = paint(COMBO.min + 2).text;
    assert.ok(fontSize(high) > fontSize(low), '더 크게');
    assert.notEqual(high.color, low.color, '색도 달라진다');

    const huge = paint(COMBO.min + 99).text;
    assert.equal(fontSize(huge), COMBO.maxSize, '그래도 상한이 있다');
    assert.equal(huge.color, COMBO.colors[COMBO.colors.length - 1], '색도 마지막 색에서 멈춘다');
  });

  it('연쇄가 이어지면 최신 콤보 하나만 띄운다', () => {
    const ctx = createStubContext();
    const fx = new Effects();
    fx.spawn(round(2));
    fx.update(60);
    fx.spawn(round(3));
    fx.draw(ctx);
    assert.equal(ctx.texts.length, 1, '숫자가 겹치면 읽을 수 없다');
    assert.equal(ctx.texts[0].text, '3Combo!');
  });

  it('떠오르며 옅어지다 사라진다', () => {
    const fx = new Effects();
    fx.spawn(round(3));
    fx.draw(createStubContext());
    const first = fx.combo;

    const ctx = createStubContext();
    fx.update(COMBO.showMs * 0.9);
    fx.draw(ctx);
    assert.ok(ctx.texts[0].y < ROWS * CELL * COMBO.y, '위로 떠오른다');
    assert.ok(ctx.texts[0].alpha < 1, '끝으로 갈수록 옅어진다');
    assert.equal(fx.combo, first, '아직 떠 있다');

    fx.update(COMBO.showMs * 0.2);
    assert.equal(fx.combo, null);
    assert.ok(!fx.busy, '다 지나가면 그릴 것도 없다');
  });
});

describe('착지 이펙트', () => {
  const hit = (distance, cells = [[ROWS - 1, 4], [ROWS - 1, 5]]) => ({ cells, distance, color: 1 });

  it('먼지가 충격면에서 튀고 카메라가 아래로 눌린다', () => {
    const fx = new Effects();
    fx.impact(hit(12));
    assert.ok(fx.dust.length >= 2, '칸마다 먼지가 생긴다');
    assert.ok(fx.dust.every(d => d.y === ROWS * CELL), '먼지는 닿은 칸의 아랫면에서 시작');
    assert.ok(fx.dust.every(d => d.vy < 0), '위로 튄다');
    assert.ok(fx.busy, '먼지가 남아 있는 동안은 그려야 한다');

    const [, dy] = fx.shakeOffset();
    assert.ok(dy > 0, '카메라가 아래로 눌린다');
  });

  it('게임 시간은 멈추지 않고, 삭제보다 약하게 흔들린다', () => {
    const fx = new Effects();
    fx.impact(hit(21));
    assert.ok(!fx.frozen, '하드드롭마다 멈추면 답답해진다');
    assert.ok(fx.shake > 0 && fx.shake < 6, `흔들림이 과하다: ${fx.shake}`);
  });

  it('짧게 떨어지면 거의 티가 나지 않고, 붙어 있었다면 아무 일도 없다', () => {
    const far = new Effects();
    far.impact(hit(12));
    const near = new Effects();
    near.impact(hit(2));
    assert.ok(near.dust.length < far.dust.length && near.kick < far.kick);

    const none = new Effects();
    none.impact(hit(0));
    assert.equal(none.dust.length, 0);
    assert.deepEqual(none.shakeOffset(), [0, 0]);
  });

  it('시간이 지나면 먼지도 카메라도 제자리로 돌아온다', () => {
    const fx = new Effects();
    fx.impact(hit(21));
    for (let i = 0; i < 20; i++) fx.update(60);
    assert.equal(fx.dust.length, 0);
    assert.ok(!fx.busy);
    assert.deepEqual(fx.shakeOffset(), [0, 0]);
  });
});

describe('페널티 이펙트', () => {
  before(() => loadSprites()); // 스프라이트 파일명으로 색을 확인하므로 이미지가 필요하다

  // 파란 뱀 — 페널티로 색이 바뀌는 게 보이도록
  const blueGame = () => {
    const game = new Game();
    game.next = { len: 4, color: 3, dir: 1 };
    game.spawn();
    return game;
  };

  it('자기 몸을 밟으면 화면이 흔들리고 붉은 기운이 켜진다', () => {
    const fx = new Effects();
    assert.equal(fx.penaltyFlash, 0);
    fx.penalty();
    assert.equal(fx.penaltyFlash, 1);

    const [sx, sy] = fx.shakeOffset();
    assert.ok(sx !== 0 || sy !== 0, '화면이 흔들린다');
    assert.ok(fx.shake < FX.shakeMax, `흔들림이 과하다: ${fx.shake}`);
    assert.ok(!fx.frozen, '페널티로 이미 낙하가 시작되므로 게임 시간은 멈추지 않는다');
  });

  it('시간이 지나면 붉은 기운도 흔들림도 걷힌다', () => {
    const fx = new Effects();
    fx.penalty();
    for (let i = 0; i < 10; i++) fx.update(60);
    assert.equal(fx.penaltyFlash, 0);
    assert.deepEqual(fx.shakeOffset(), [0, 0]);
  });

  it('페널티 동안 뱀이 제 색 대신 빨간 스프라이트로 그려진다', () => {
    const ctx = createStubContext();
    const fx = new Effects();
    fx.penalty();
    drawBoard(ctx, blueGame(), fx);
    assert.ok(ctx.draws.length > 0);
    assert.ok(ctx.draws.every(d => /0\.png$/.test(d.src)), `빨간 스프라이트: ${ctx.draws[0].src}`);
    assert.equal(ctx.globalAlpha, 1, '알파는 되돌려 놓는다');
    assert.equal(ctx.globalCompositeOperation, 'source-over', '합성 모드도 되돌려 놓는다');
  });

  it('달아오른 겹이 원래 그림 위에 덧그려진다', () => {
    const ctx = createStubContext();
    const fx = new Effects();
    fx.penalty();
    const game = blueGame();
    drawBoard(ctx, game, fx);

    const solid = ctx.draws.filter(d => d.alpha === 1);
    const glow = ctx.draws.filter(d => d.alpha > 0 && d.alpha < 1 && d.y === solid[0].y);
    assert.equal(solid.length, game.snake.length, '뱀 한 벌');
    assert.equal(glow.length, game.snake.length, '같은 자리에 덧그리는 한 벌 더');
  });

  it('페널티가 끝나면 제 색으로 돌아온다', () => {
    const ctx = createStubContext();
    const fx = new Effects();
    fx.penalty();
    fx.update(PENALTY.flashMs);
    drawBoard(ctx, blueGame(), fx);
    assert.ok(ctx.draws.every(d => /2\.png$/.test(d.src)), `파란 스프라이트: ${ctx.draws[0].src}`);
  });

  it('붉은 조각이 굳으면 거기서 끝난다 (다음 조각이 물들지 않게)', () => {
    const fx = new Effects();
    fx.penalty();
    fx.endPenalty();
    assert.equal(fx.penaltyFlash, 0);
  });
});

describe('확정 이펙트', () => {
  before(() => loadSprites());

  // 튀는 방향까지 확인하므로 난수를 고정한다 (Math.random이면 가끔 한쪽으로 몰린다)
  const seeded = (seed = 1) => () => (seed = seed * 16807 % 2147483647) / 2147483647;

  const game = () => {
    const g = new Game();
    g.next = { len: 4, color: 3, dir: 1 };
    g.spawn();
    return g;
  };

  it('모양이 굳으면 하얗게 뜨고 칸마다 반짝이가 튄다', () => {
    const fx = new Effects({ rng: seeded() });
    const cells = [[5, 4], [5, 5], [5, 6]];
    fx.confirm(cells);

    assert.equal(fx.confirmGlow, 1);
    assert.equal(fx.sparks.length, cells.length * CONFIRM.sparks);
    assert.ok(fx.busy, '반짝이가 남아 있는 동안은 그려야 한다');
    assert.ok(fx.sparks.every(s => Math.hypot(s.vx, s.vy) > 0), '멈춰 있는 조각은 없다');
    assert.ok(fx.sparks.some(s => s.vy < 0) && fx.sparks.some(s => s.vy > 0), '사방으로 흩어진다');
    assert.ok(fx.sparks.every(s => s.x >= 4 * CELL && s.x <= 7 * CELL), '제 칸에서 시작한다');
  });

  it('뱀만 부르르 떨고, 화면은 흔들리지도 멈추지도 않는다', () => {
    const fx = new Effects({ rng: seeded() });
    fx.confirm([[5, 4]]);
    assert.ok(!fx.frozen);
    assert.deepEqual(fx.shakeOffset(), [0, 0], '필드와 쌓인 블록은 가만히 있는다');

    const [dx, dy] = fx.snakeOffset();
    assert.ok(dx !== 0 || dy !== 0, '뱀은 떤다');
    assert.ok(Math.abs(dx) <= CONFIRM.shake && Math.abs(dy) <= CONFIRM.shake,
      `떨림이 과하다: ${dx}, ${dy}`);
  });

  it('떨림은 금세 잦아든다', () => {
    const fx = new Effects({ rng: seeded() });
    fx.confirm([[5, 4]]);
    fx.update(CONFIRM.shakeMs / 2);
    const half = Math.max(...fx.snakeOffset().map(Math.abs));
    assert.ok(half <= CONFIRM.shake / 2, `절반쯤 지나면 폭도 절반: ${half}`);

    fx.update(CONFIRM.shakeMs);
    assert.deepEqual(fx.snakeOffset(), [0, 0]);
  });

  it('섀도우는 떨지 않는다 — 착지 자리를 가리키는 표지판이니까', () => {
    const g = game();
    const fx = new Effects({ rng: seeded() });
    fx.confirm(g.snake.cells);

    const ctx = createStubContext();
    drawBoard(ctx, g, fx);
    const homes = g.snake.cells.map(([, c]) => c * CELL + CELL / 2);
    const ghosts = ctx.draws.filter(d => d.alpha < 1);
    assert.equal(ghosts.length, g.snake.length);
    assert.ok(ghosts.every(d => homes.includes(d.x)), '섀도우는 제 칸에 그대로 있다');
  });

  it('반짝이는 반 칸쯤 튀고 사라진다', () => {
    const fx = new Effects({ rng: seeded() });
    fx.confirm([[5, 4]]);
    const start = fx.sparks.map(s => [s.x, s.y]);

    for (let i = 0; i < 4; i++) fx.update(60);
    const moved = fx.sparks.map((s, i) => Math.hypot(s.x - start[i][0], s.y - start[i][1]));
    assert.ok(moved.every(d => d > 0 && d < CELL), `튀는 거리가 과하다: ${Math.max(...moved)}`);

    for (let i = 0; i < 4; i++) fx.update(60);
    assert.equal(fx.sparks.length, 0);
    assert.equal(fx.confirmGlow, 0);
    assert.ok(!fx.busy);
  });

  it('그동안 뱀이 하얀 한 겹으로 덧그려지고, 끝나면 원래대로다', () => {
    const g = game();
    const fx = new Effects();
    fx.confirm(g.snake.cells);

    const lit = createStubContext();
    drawBoard(lit, g, fx);
    assert.equal(lit.draws.filter(d => d.alpha === 1).length, g.snake.length * 2, '제 색 + 하얀 겹');
    assert.equal(lit.filter, 'none', '필터는 되돌려 놓는다');
    assert.equal(lit.globalAlpha, 1);

    fx.update(CONFIRM.flashMs);
    const done = createStubContext();
    drawBoard(done, g, fx);
    assert.equal(done.draws.filter(d => d.alpha === 1).length, g.snake.length, '한 벌만 남는다');
  });
});
