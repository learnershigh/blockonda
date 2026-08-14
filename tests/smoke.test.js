import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createStubContext, stubImages } from './helpers/canvas-stub.js';

/**
 * main.js가 실제로 부팅되는지 확인한다.
 * (DOM id, 모듈 경로, 루프/입력 배선처럼 단위 테스트가 못 잡는 부분)
 */
const frames = [];
let now = 0;
const els = {};
const listeners = {};

function fakeCanvas() {
  const ctx = createStubContext();
  return { width: 0, height: 0, style: {}, getContext: () => ctx };
}

// main.js를 불러오기 전에 브라우저 환경을 미리 흉내 낸다
{
  stubImages();
  for (const id of ['board', 'next']) els[id] = fakeCanvas();
  els.score = { textContent: '' };
  els.time = { textContent: '', style: {} };
  els.overlay = {
    innerHTML: '',
    classList: { add() { this.hidden = true; }, remove() { this.hidden = false; }, hidden: false },
    addEventListener(type, fn) { listeners['overlay:' + type] = fn; },
  };

  globalThis.performance = { now: () => now };
  globalThis.requestAnimationFrame = fn => frames.push(fn);
  globalThis.document = {
    getElementById: id => els[id],
    addEventListener: (type, fn) => { listeners['doc:' + type] = fn; },
  };
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: (type, fn) => { listeners['win:' + type] = fn; },
  };
}

const step = (ms = 16) => {
  now += ms;
  frames.splice(0).forEach(fn => fn(now));
};
const press = code => listeners['doc:keydown']({ code, repeat: false, preventDefault() {} });

describe('부팅', () => {
  it('main.js를 불러오면 화면과 입력이 연결된다', async () => {
    await import('../src/main.js');

    assert.ok(listeners['doc:keydown'], '키 입력 연결');
    assert.ok(listeners['overlay:click'], '오버레이 클릭 연결');
    assert.ok(listeners['win:blur'], '포커스 이탈 시 일시정지 연결');
    assert.match(els.overlay.innerHTML, /BLOCKONDA/, '시작 화면 표시');

    step(); // 첫 프레임
    assert.ok(els.board.getContext().draws.length > 0, '보드에 뭔가 그려진다');
    assert.ok(els.next.getContext().draws.length > 0, 'NEXT 미리보기도 그려진다');
  });

  it('아무 키나 누르면 시작되고 설계 시간이 흐른다', () => {
    press('ArrowLeft');           // 시작
    assert.equal(els.overlay.classList.hidden, true, '오버레이가 닫힌다');

    step(100);
    const shown = els.time.textContent;
    assert.match(shown, /^\d\.\d$/, '남은 시간 표시');

    step(500);
    assert.notEqual(els.time.textContent, shown, '시간이 줄어든다');
  });

  it('SPACE 두 번이면 확정 후 하드드롭되어 점수가 오른다', () => {
    press('Space');
    press('Space');
    step();
    assert.ok(Number(els.score.textContent) > 0);
  });

  // 확정 연출은 이벤트가 아니라 루프가 phase 전환을 보고 건다 — 그 배선을 확인한다
  it('모양을 확정하면 뱀이 한 겹 더 그려진다', () => {
    const ctx = els.board.getContext();
    ctx.draws.length = 0;
    step();
    const designing = ctx.draws.length; // 설계 중인 평범한 프레임

    press('Space');                     // 모양 확정
    ctx.draws.length = 0;
    step();
    assert.ok(ctx.draws.length > designing, '하얗게 번쩍이는 겹이 얹힌다');
  });
});
