import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createStubContext, stubImages } from './helpers/canvas-stub.js';

stubImages();

const { CELL } = await import('../src/config.js');
const { createContext, devicePixel, seamBleed, snapToPixel } = await import('../src/render/canvas.js');
const { loadSprites } = await import('../src/assets.js');
const { drawSegment } = await import('../src/render/sprites.js');

loadSprites();

function fakeCanvas() {
  return { width: 0, height: 0, style: {}, getContext: () => createStubContext() };
}

/** 배율 dpr짜리 화면인 척하고 캔버스를 준비한다 */
function withRatio(dpr, width = 300, height = 630) {
  const listeners = {};
  globalThis.window = {
    devicePixelRatio: dpr,
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  const canvas = fakeCanvas();
  const ctx = createContext(canvas, width, height);
  return { canvas, ctx, listeners };
}

describe('화면 배율', () => {
  afterEach(() => { delete globalThis.window; });

  it('backing store는 언제나 정수 픽셀이다', () => {
    for (const dpr of [1, 1.25, 1.5, 1.75, 2, 2.5]) {
      const { canvas } = withRatio(dpr);
      assert.ok(Number.isInteger(canvas.width) && Number.isInteger(canvas.height), `dpr ${dpr}`);
      assert.equal(canvas.width, Math.round(300 * dpr));
      assert.equal(canvas.style.width, '300px', 'CSS 크기는 그대로 — 레이아웃은 안 흔든다');
    }
  });

  it('배율이 소수면 칸을 한 픽셀 키워 이음매를 메운다', () => {
    withRatio(1.25);
    assert.equal(devicePixel(), 1 / 1.25);
    assert.equal(seamBleed(), 1 / 1.25, '화면 한 픽셀만큼');

    const ctx = createStubContext();
    drawSegment(ctx, 0, 0, CELL, 1, { head: [-1, 0] });
    const [draw] = ctx.draws;
    assert.ok(draw.w > CELL, '이웃 칸과 겹치도록 키워 그린다');
    assert.equal(draw.w, CELL + 1 / 1.25);
    assert.deepEqual([draw.x, draw.y], [CELL / 2, CELL / 2], '중심은 그대로라 그림이 밀리지 않는다');
  });

  it('배율이 정수면 보정 없이 원래 크기로 그린다', () => {
    for (const dpr of [1, 2, 3]) {
      withRatio(dpr);
      assert.equal(seamBleed(), 0, `dpr ${dpr}에서는 칸이 이미 딱 맞는다`);

      const ctx = createStubContext();
      drawSegment(ctx, 0, 0, CELL, 1, { head: [-1, 0] });
      assert.equal(ctx.draws[0].w, CELL);
    }
  });

  it('소수로 움직이는 값은 화면 픽셀에 붙인다', () => {
    withRatio(2);
    assert.equal(snapToPixel(1.3), 1.5, '배율 2에서는 0.5 단위');
    withRatio(1);
    assert.equal(snapToPixel(1.3), 1);
    assert.equal(snapToPixel(-2.6), -3);
  });

  it('창 배율이 바뀌면 다시 잡는다', () => {
    const { canvas, listeners } = withRatio(1);
    assert.equal(canvas.width, 300);

    globalThis.window.devicePixelRatio = 1.5;
    listeners.resize();
    assert.equal(canvas.width, 450, '확대하면 backing store도 따라 커진다');
    assert.equal(devicePixel(), 1 / 1.5);
  });
});
