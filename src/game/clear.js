import { SCORE } from '../config.js';

/**
 * 좌우 벽에 모두 닿은 같은 색 덩어리를 터뜨린다.
 * 터진 뒤 남은 조각이 떨어지며 새 연결이 생기면 연쇄로 이어지고, 배율이 x2, x3...로 올라간다.
 * @returns {Array<{chain:number, groups:number, cells:Array, points:number}>} 라운드별 결과
 */
export function resolveClears(board) {
  const rounds = [];
  for (let chain = 1; ; chain++) {
    const comps = board.findSpanning();
    if (!comps.length) return rounds;

    const flat = comps.flat();
    // 이펙트가 쓸 수 있도록 지워지기 전의 색/머리 정보를 남겨둔다
    const cells = flat.map(([r, c]) => ({ r, c, color: board.color[r][c], head: board.head[r][c] }));
    board.remove(flat);
    board.applyGravity();

    rounds.push({ chain, groups: comps.length, cells, points: cells.length * SCORE.cell * chain });
  }
}
