import { CASCADE, SCORE } from '../config.js';

/**
 * 좌우 벽에 모두 닿은 같은 색 덩어리를 터뜨리고, 그 뒤의 연쇄를 시간에 맞춰 진행하는 상태 기계.
 *
 * 한 프레임에 연쇄를 다 끝내 버리면 화면은 마지막 결과로 순간이동해서
 * 몇 번 연쇄가 났는지 눈으로 알 수가 없다. 그래서 한 라운드를 이렇게 쪼갠다.
 *
 *   pop() 터짐 → popMs 동안 빈 자리를 보여줌 → fallMs 마다 한 칸씩 낙하
 *   → 다 내려앉으면 settleMs 동안 그 모습을 보여줌 → 다시 pop()
 *
 * 시간은 step(dt)으로만 흐르고, 점수와 이벤트는 부르는 쪽(Game)이 처리한다.
 */
export class Cascade {
  constructor(board) {
    this.board = board;
    this.chain = 0;      // 지금까지 터뜨린 라운드 수 (= 다음 배율)
    this.wait = 0;       // 다음 단계까지 남은 시간(ms)
    this.settled = true; // 필드가 다 내려앉아 있다
  }

  /**
   * 다음 라운드를 터뜨린다. 블록을 지우기만 하고 낙하는 step()에 맡긴다.
   * @returns {?{chain:number, groups:number, cells:Array, points:number}} 터질 게 없으면 null
   */
  pop() {
    const comps = this.board.findSpanning();
    if (!comps.length) return null;

    const flat = comps.flat();
    // 이펙트가 쓸 수 있도록 지워지기 전의 색/머리 정보를 남겨둔다
    const cells = flat.map(([r, c]) => ({
      r, c,
      color: this.board.color[r][c],
      head: this.board.head[r][c],
      tail: this.board.tail[r][c],
      link: this.board.linksAt(r, c),
    }));
    this.board.remove(flat);

    this.chain++;
    this.settled = false;
    this.wait = CASCADE.popMs;
    return { chain: this.chain, groups: comps.length, cells, points: cells.length * SCORE.cell * this.chain };
  }

  /**
   * 시간을 흘려보낸다.
   * @returns {boolean} 아직 떨어지거나 뜸 들이는 중이면 true, 다 내려앉아 다음 판정을 할 때면 false
   */
  step(dt) {
    this.wait -= dt;
    while (this.wait <= 0) {
      if (this.board.gravityStep()) {  // 남은 블록이 한 칸 내려온다
        this.wait += CASCADE.fallMs;
        continue;
      }
      if (this.settled) return false;  // 더 떨어질 것도 없고 보여줄 만큼 보여줬다
      this.settled = true;             // 방금 멈췄다 — 자리잡은 모습을 한 박자 보여준다
      this.wait += CASCADE.settleMs;
    }
    return true;
  }
}
