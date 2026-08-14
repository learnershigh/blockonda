// 게임 규칙/연출 수치를 한곳에 모아둔 곳. 밸런스 조정은 여기만 만지면 된다.

export const COLS = 10;
export const ROWS = 21;
export const CELL = 30;                       // 필드 한 칸의 픽셀 크기
export const SPAWN_ROW = 1;                   // 맨 위에서 한 칸 떨어진 곳에서 등장

export const PREVIEW = { w: 108, h: 84, cell: 15 };

export const DESIGN_MS = 5000;                // 모양 설계 타임
export const MIN_LEN = 3;                     // 뱀 길이 범위
export const MAX_LEN = 6;

// 스프라이트(assets/Snake_*.png)와 같은 순서: 빨강 / 초록 / 파랑
// 필드에는 이 배열의 (인덱스 + 1)이 색 번호로 저장된다. 0은 빈 칸.
export const PALETTE = ['#b11616', '#4ab116', '#4916b1'];

// 머리가 바라보는 4방향. 필드의 head 칸에는 (인덱스 + 1)이 저장된다.
export const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export const SCORE = {
  soft: 1,        // 소프트드롭 1칸
  hard: 2,        // 하드드롭 1칸
  cell: 10,       // 삭제된 칸 하나 (x 연쇄 배율)
};

export const SPEED = {
  base: 750,      // 시작 낙하 간격(ms)
  min: 90,        // 최대 속도
  per: 25,        // 블록 몇 개마다
  step: 60,       // 얼마나 빨라지는지(ms)
};

export const FX = {
  dissolveMs: 420,  // 디졸브 지속
  rowFlashMs: 170,  // 삭제된 줄을 훑는 섬광
  split: 4,         // 한 칸을 4x4 조각으로 쪼갠다
  shakeDecay: 0.05, // ms당 감쇠
  shakeMax: 18,
};
