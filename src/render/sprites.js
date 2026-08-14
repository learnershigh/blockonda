import { PALETTE } from '../config.js';
import { isReady, sprites } from '../assets.js';
import { LINK } from '../game/dirs.js';

/**
 * 원본 스프라이트의 기준 자세
 *  - 머리   : 왼쪽을 보고, 몸통은 오른쪽으로 이어진다
 *  - 몸통   : 좌우로 이어지는 가로 세그먼트
 *  - 코너   : 왼쪽 ↔ 아래로 꺾인다
 * 나머지 방향은 회전(시계방향)이나 좌우반전으로 만든다.
 */
const CORNER_ANGLE = {
  [LINK.LEFT | LINK.DOWN]: 0,
  [LINK.UP | LINK.LEFT]: Math.PI / 2,
  [LINK.RIGHT | LINK.UP]: Math.PI,
  [LINK.DOWN | LINK.RIGHT]: -Math.PI / 2,
};
const VERTICAL = new Set([LINK.UP | LINK.DOWN, LINK.UP, LINK.DOWN]);

/**
 * 한 칸에 무엇을 어떤 자세로 그릴지 고른다.
 * @param {object} segment - { head: [dx,dy]|null, links: 연결 비트 }
 */
export function pickSprite(color, { head = null, links = 0 } = {}) {
  const index = color - 1;
  if (head) {
    const [dx, dy] = head;
    if (dx > 0) return { img: sprites.heads[index], angle: 0, flip: true };   // 오른쪽 = 좌우반전
    if (dy < 0) return { img: sprites.heads[index], angle: Math.PI / 2 };     // 위
    if (dy > 0) return { img: sprites.heads[index], angle: -Math.PI / 2 };    // 아래
    return { img: sprites.heads[index], angle: 0 };                          // 왼쪽 = 원본
  }
  const corner = CORNER_ANGLE[links];
  if (corner !== undefined) return { img: sprites.corners[index], angle: corner };
  return { img: sprites.bodies[index], angle: VERTICAL.has(links) ? Math.PI / 2 : 0 };
}

/** 뱀의 한 칸을 그린다 (머리 / 몸통 / 코너를 알아서 고른다) */
export function drawSegment(ctx, x, y, size, color, segment, ghost = false) {
  const { img, angle = 0, flip = false } = pickSprite(color, segment);
  if (ghost) ctx.globalAlpha = 0.32;
  const drawn = drawTransformed(ctx, img, x, y, size, angle, flip);
  if (ghost) ctx.globalAlpha = 1;
  if (!drawn) drawFallbackCell(ctx, x, y, size, PALETTE[color - 1], ghost);
}

function drawTransformed(ctx, img, x, y, size, angle, flip) {
  if (!isReady(img)) return false;
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  if (flip) ctx.scale(-1, 1);
  if (angle) ctx.rotate(angle);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
  return true;
}

/** 이미지가 준비되기 전에 쓰는 색 사각형 */
export function drawFallbackCell(ctx, x, y, size, color, ghost) {
  const pad = 1, s = size - 2;
  if (ghost) {
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = color;
    ctx.fillRect(x + pad, y + pad, s, s);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.fillStyle = color;
  ctx.fillRect(x + pad, y + pad, s, s);
  const b = Math.max(2, Math.floor(size * 0.14));
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x + pad, y + pad, s, b);
  ctx.fillRect(x + pad, y + pad, b, s);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + pad, y + pad + s - b, s, b);
  ctx.fillRect(x + pad + s - b, y + pad, b, s);
}
