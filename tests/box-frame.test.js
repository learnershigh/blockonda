import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { opaqueBounds } from '../src/render/box-frame.js';

/** width x height RGBA 버퍼를 만들고, rect 영역만 불투명하게 채운다 */
function makePixels(width, height, rect) {
  const data = new Uint8ClampedArray(width * height * 4);
  if (!rect) return data;
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      data[(y * width + x) * 4 + 3] = 255;
    }
  }
  return data;
}

describe('opaqueBounds (박스 그림의 투명 여백 잘라내기)', () => {
  it('그림이 들어 있는 영역만 골라낸다', () => {
    const rect = { x: 13, y: 13, width: 22, height: 23 }; // 실제 Box00.png 배치
    const bounds = opaqueBounds(makePixels(48, 48, rect), 48, 48);
    assert.deepEqual(bounds, rect);
  });

  it('여백이 없으면 이미지 전체가 그대로다', () => {
    const bounds = opaqueBounds(makePixels(16, 16, { x: 0, y: 0, width: 16, height: 16 }), 16, 16);
    assert.deepEqual(bounds, { x: 0, y: 0, width: 16, height: 16 });
  });

  it('한쪽으로 치우쳐 있어도 정확히 잡는다', () => {
    const rect = { x: 0, y: 5, width: 3, height: 2 };
    assert.deepEqual(opaqueBounds(makePixels(8, 8, rect), 8, 8), rect);
  });

  it('전부 투명하면 null', () => {
    assert.equal(opaqueBounds(makePixels(8, 8, null), 8, 8), null);
  });
});
