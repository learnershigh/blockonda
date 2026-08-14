import { PALETTE } from '../config.js';
import { isReady, sprites } from '../assets.js';

/**
 * 스프라이트 한 칸. 원본 머리가 왼쪽을 보므로
 * 오른쪽은 좌우반전, 위/아래는 90도 회전해서 그린다.
 * @returns {boolean} 이미지가 없어서 못 그렸으면 false
 */
export function drawSprite(ctx, img, x, y, size, dx, dy) {
  if (!isReady(img)) return false;
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  if (dx > 0) ctx.scale(-1, 1);
  else if (dy < 0) ctx.rotate(Math.PI / 2);
  else if (dy > 0) ctx.rotate(-Math.PI / 2);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
  return true;
}

export function spriteFor(color, facing) {
  return facing ? sprites.heads[color - 1] : sprites.bodies[color - 1];
}

/** 뱀의 한 칸. facing이 있으면 그 방향의 머리, 없으면 몸통. */
export function drawSnakeCell(ctx, x, y, size, color, facing, ghost = false) {
  const [dx, dy] = facing || [-1, 0];
  if (ghost) ctx.globalAlpha = 0.32;
  const drawn = drawSprite(ctx, spriteFor(color, facing), x, y, size, dx, dy);
  if (ghost) ctx.globalAlpha = 1;
  if (!drawn) drawFallbackCell(ctx, x, y, size, PALETTE[color - 1], ghost);
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
