/**
 * UI 패널 테두리로 쓰는 9-slice 박스 스프라이트.
 *
 * 원본(assets/Box00.png)은 타일 규격에 맞춰 그림 주위에 투명 여백이 있다.
 * 그대로 border-image에 넘기면 여백까지 테두리로 잘리기 때문에,
 * 불투명한 부분만 잘라낸 뒤 CSS 변수로 넘겨준다.
 * 덕분에 여백이 다른 그림으로 바꿔 넣어도 그대로 동작한다.
 */
const ALPHA_THRESHOLD = 8;

export async function applyBoxFrame(src, { slice = 5, scale = 3, root = document.documentElement } = {}) {
  const image = await loadImage(src);
  const trimmed = trimTransparent(image);
  if (!trimmed) return false;

  root.style.setProperty('--box-image', `url(${trimmed})`);
  root.style.setProperty('--box-slice', String(slice));
  root.style.setProperty('--frame', `${slice * scale}px`);
  root.classList.add('box-ui'); // 준비된 뒤에 켜야 실패 시 기본 디자인이 남는다
  return true;
}

/** 불투명 픽셀을 감싸는 최소 사각형. 없으면 null */
export function opaqueBounds(data, width, height) {
  let top = height, left = width, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < ALPHA_THRESHOLD) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (right < 0) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

function trimTransparent(image) {
  const w = image.naturalWidth, h = image.naturalHeight;
  const source = document.createElement('canvas');
  source.width = w;
  source.height = h;
  const sourceCtx = source.getContext('2d', { willReadFrequently: true });
  sourceCtx.drawImage(image, 0, 0);

  const bounds = opaqueBounds(sourceCtx.getImageData(0, 0, w, h).data, w, h);
  if (!bounds) return null;

  const out = document.createElement('canvas');
  out.width = bounds.width;
  out.height = bounds.height;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
  return out.toDataURL();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${src}`));
    image.src = src;
  });
}
