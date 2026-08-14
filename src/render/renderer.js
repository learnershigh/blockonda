import { CELL, COLS, PREVIEW, ROWS } from '../config.js';
import { dirVec, LINK } from '../game/dirs.js';
import { drawSegment } from './sprites.js';

const BOARD_BG = '#0d1320';
const GRID_LINE = 'rgba(255,255,255,0.045)';

/** 필드 + 조작 중인 뱀 + 섀도우 + 삭제 이펙트 */
export function drawBoard(ctx, game, effects) {
  const w = COLS * CELL, h = ROWS * CELL;
  ctx.fillStyle = BOARD_BG;
  ctx.fillRect(0, 0, w, h); // 배경은 흔들지 않는다 (가장자리가 비지 않도록)

  ctx.save();
  const [sx, sy] = effects ? effects.shakeOffset() : [0, 0];
  if (sx || sy) ctx.translate(sx, sy);

  drawGrid(ctx, w, h);
  drawStack(ctx, game.board);
  if (!game.over) drawSnake(ctx, game);
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
  for (let i = 0; i < piece.len; i++) {
    const head = i === headIndex ? [piece.dir, 0] : null;
    const links = (i > 0 ? LINK.LEFT : 0) | (i < piece.len - 1 ? LINK.RIGHT : 0);
    drawSegment(ctx, ox + i * cell, oy, cell, piece.color, { head, links });
  }
}

function drawGrid(ctx, w, h) {
  ctx.strokeStyle = GRID_LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < COLS; c++) { ctx.moveTo(c * CELL + 0.5, 0); ctx.lineTo(c * CELL + 0.5, h); }
  for (let r = 1; r < ROWS; r++) { ctx.moveTo(0, r * CELL + 0.5); ctx.lineTo(w, r * CELL + 0.5); }
  ctx.stroke();
}

/** 쌓인 블록. 머리와 꺾인 자리(코너)는 쌓인 뒤에도 그대로 남는다. */
function drawStack(ctx, board) {
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const color = board.color[r][c];
      if (!color) continue;
      const segment = { head: dirVec(board.head[r][c]), links: board.linksAt(r, c) };
      drawSegment(ctx, c * CELL, r * CELL, CELL, color, segment);
    }
  }
}

function drawSnake(ctx, game) {
  const { snake, board } = game;
  const facing = snake.facing;
  const distance = snake.dropDistance(board);
  const paint = (offset, ghost) => snake.cells.forEach(([r, c], i) => {
    const segment = { head: i === 0 ? facing : null, links: snake.linksAt(i) };
    drawSegment(ctx, c * CELL, (r + offset) * CELL, CELL, snake.color, segment, ghost);
  });

  if (distance > 0) paint(distance, true); // 섀도우에도 머리 방향이 보인다
  paint(0, false);
}
