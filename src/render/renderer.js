import { CELL, COLS, CONFIRM, PENALTY, PREVIEW, ROWS } from '../config.js';
import { dirVec, LINK } from '../game/dirs.js';
import { seamBleed, snapToPixel } from './canvas.js';
import { drawSegment } from './sprites.js';

const BOARD_BG = '#0d1320';
const CHECKER = 'rgba(255,255,255,0.045)'; // 체커보드에서 밝게 칠하는 칸

/** 필드 + 조작 중인 뱀 + 섀도우 + 삭제 이펙트 */
export function drawBoard(ctx, game, effects) {
  const w = COLS * CELL, h = ROWS * CELL;
  ctx.fillStyle = BOARD_BG;
  ctx.fillRect(0, 0, w, h); // 배경은 흔들지 않는다 (가장자리가 비지 않도록)

  ctx.save();
  // 흔들림은 소수로 움직인다 — 화면 픽셀에 맞춰 붙여야 칸 사이가 벌어지지 않는다
  const [sx, sy] = effects ? effects.shakeOffset().map(snapToPixel) : [0, 0];
  if (sx || sy) ctx.translate(sx, sy);

  drawGrid(ctx);
  drawStack(ctx, game.board);
  if (game.hasPiece) drawSnake(ctx, game, effects);
  if (effects && effects.busy) effects.draw(ctx);

  ctx.restore();
}

export function drawPreview(ctx, piece) {
  ctx.clearRect(0, 0, PREVIEW.w, PREVIEW.h);
  if (!piece) return;
  const { cell } = PREVIEW;
  const ox = (PREVIEW.w - piece.len * cell) / 2;
  const oy = (PREVIEW.h - cell) / 2;
  const headIndex = piece.dir > 0 ? piece.len - 1 : 0; // 머리 = 바라보는 방향 쪽 끝
  const tailIndex = piece.dir > 0 ? 0 : piece.len - 1;   // 머리 반대쪽 끝
  for (let i = 0; i < piece.len; i++) {
    const head = i === headIndex ? [piece.dir, 0] : null;
    const tail = i === tailIndex ? [piece.dir, 0] : null; // 몸통은 머리 쪽으로 이어진다
    const links = (i > 0 ? LINK.LEFT : 0) | (i < piece.len - 1 ? LINK.RIGHT : 0);
    drawSegment(ctx, ox + i * cell, oy, cell, piece.color, { head, tail, links });
  }
}

/** 체커보드 바닥. 선을 긋는 대신 한 칸 걸러 한 칸만 살짝 밝게 칠한다. */
function drawGrid(ctx) {
  const size = CELL + seamBleed(); // 스프라이트와 같은 이유로 살짝 키워 맞물린다
  ctx.fillStyle = CHECKER;
  for (let r = 0; r < ROWS; r++) {
    for (let c = r % 2; c < COLS; c += 2) ctx.fillRect(c * CELL, r * CELL, size, size);
  }
}

/** 쌓인 블록. 머리와 꺾인 자리(코너)는 쌓인 뒤에도 그대로 남는다. */
function drawStack(ctx, board) {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const color = board.color[r][c];
      if (!color) continue;
      const segment = {
        head: dirVec(board.head[r][c]),
        tail: dirVec(board.tail[r][c]),
        links: board.linksAt(r, c),
      };
      drawSegment(ctx, c * CELL, r * CELL, CELL, color, segment);
    }
  }
}

/**
 * 조작 중인 뱀. effects가 알려주는 세기에 따라 색이 변하고 몸을 떤다.
 *  - penaltyFlash : 자기 몸을 밟았다 — 제 색을 잃고 빨갛게
 *  - confirmGlow  : 모양이 확정됐다 — 하얗게 번쩍
 *  - snakeOffset  : 확정 순간의 떨림 (필드가 아니라 뱀에만 걸린다)
 */
function drawSnake(ctx, game, effects) {
  const { snake, board } = game;
  const facing = snake.facing;
  const distance = snake.dropDistance(board);
  const last = snake.cells.length - 1;
  const flash = effects ? effects.penaltyFlash : 0;
  const glow = effects ? effects.confirmGlow : 0;
  const color = flash > 0 ? PENALTY.tint : snake.color;
  const paint = (offset, ghost) => snake.cells.forEach(([r, c], i) => {
    const segment = {
      head: i === 0 ? facing : null,
      tail: i === last ? snake.tailDir : null,
      links: snake.linksAt(i),
    };
    drawSegment(ctx, c * CELL, (r + offset) * CELL, CELL, color, segment, ghost);
  });

  if (distance > 0) paint(distance, true); // 섀도우에도 머리 방향이 보인다

  // 확정 순간의 떨림. 섀도우는 여기서 제외한다 — 착지 자리를 가리키는 표지판이라 떨면 안 된다.
  // 화면 흔들림과 같은 이유로 화면 픽셀에 맞춰 붙여야 도트가 뭉개지지 않는다.
  const [qx, qy] = effects ? effects.snakeOffset().map(snapToPixel) : [0, 0];
  ctx.save();
  if (qx || qy) ctx.translate(qx, qy);
  paint(0, false);

  // 같은 그림을 더하기 합성으로 한 겹 덧그려 달아오르게 한다.
  // 사각형을 덮어씌우지 않으므로 꼬리 끝처럼 뾰족한 실루엣도 그대로 남고,
  // 원래 빨간 뱀도 밝아져서 페널티인 걸 알 수 있다.
  if (flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = flash * PENALTY.glow;
    paint(0, false);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // 확정 순간의 백색 섬광. 그림 자체를 밝혀서 그리므로 실루엣도 도트 외곽선도 살아 있고,
  // 알파로 겹쳐 옅어지면서 제 색으로 돌아온다. (filter를 모르는 브라우저면 조용히 넘어간다)
  if (glow > 0) {
    // 순서가 중요하다: 먼저 회색으로 만들고 나서 밝혀야 한다.
    // 반대로 하면 밝기에서 채널이 각각 상한에 걸려 색이 남는다 (파란 뱀이 하얘지지 않는다)
    ctx.filter = `saturate(0) brightness(${CONFIRM.glow})`;
    ctx.globalAlpha = glow;
    paint(0, false);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
