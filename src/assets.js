import { PALETTE } from './config.js';

/**
 * 뱀 스프라이트. 색 번호(1~3)와 파일 번호(00~02)가 같은 순서로 대응된다.
 * 머리 원본은 왼쪽을 보고 있어서, 그리는 쪽에서 반전/회전한다.
 */
export const sprites = { heads: [], bodies: [], corners: [] };

export function loadSprites(base = 'assets/') {
  PALETTE.forEach((_, i) => {
    const n = String(i).padStart(2, '0');
    sprites.heads[i] = loadImage(`${base}Snake_Head${n}.png`);
    sprites.bodies[i] = loadImage(`${base}Snake_Body${n}.png`);
    sprites.corners[i] = loadImage(`${base}Snake_BodyCorner${n}.png`);
  });
  return sprites;
}

/** 아직 안 왔거나 실패한 이미지는 색 사각형으로 폴백하기 위해 확인한다 */
export function isReady(img) {
  return !!(img && img.complete && img.naturalWidth);
}

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}
