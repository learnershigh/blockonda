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

// 효과음(assets/sounds/*.wav). 키는 game.js의 EVENT 값과 같아야 한다.
// volume은 0~1이며 master를 곱해서 쓴다. 파일마다 녹음 크기가 달라 개별로 맞췄다.
export const SOUND = {
  base: 'assets/sounds/',
  master: 0.7,
  music: { file: 'Bgm.mp3', volume: 0.35 }, // 배경음악 — 무한 반복, 효과음에 묻히지 않게 작게
  events: {
    spawn: { file: 'Spawn.wav', volume: 0.4 },
    move: { file: 'Move.wav', volume: 0.3 },       // 가장 자주 울려서 제일 작게
    'self-hit': { file: 'Fail.wav', volume: 0.7 },
    land: { file: 'Landing.wav', volume: 0.6 },
    clear: { file: 'LineClear.wav', volume: 0.9 },
    over: { file: 'GameOver.wav', volume: 0.9 },
  },
};

// UI 패널 테두리로 쓰는 9-slice 박스 (assets/Box00.png)
// slice = 그림에서 테두리 장식이 차지하는 두께(px). 그림을 바꾸면 이 값만 맞추면 된다.
export const BOX_FRAME = { src: 'assets/Box00.png', slice: 5, scale: 3 };

export const FX = {
  dissolveMs: 420,  // 디졸브 지속
  rowFlashMs: 170,  // 삭제된 줄을 훑는 섬광
  split: 4,         // 한 칸을 4x4 조각으로 쪼갠다
  shakeDecay: 0.05, // ms당 감쇠
  shakeMax: 18,
};

// 자기 몸 겹침 페널티 연출. 실수를 몸으로 느끼도록 짧게 때리고 화면을 붉게 물들인다.
export const PENALTY = {
  color: '#ff2d2d',
  shake: 7,      // 흔들림 px (착지보다 세게, 연쇄 삭제보다는 약하게)
  flashMs: 260,  // 붉은 기운이 걷히는 시간
  alpha: 0.3,    // 화면 전체를 덮는 붉은 기운의 최대 진하기
  band: 14,      // 가장자리를 물들이는 테두리 한 겹의 두께(px)
  rings: 4,      // 안쪽으로 갈수록 옅어지는 겹 수
};

// 하드드롭 착지 연출. 세기는 낙하 거리 / full 로 0~1이 되며, 짧게 떨어지면 거의 티가 안 난다.
export const DROP = {
  full: 9,           // 이 칸수 이상 떨어지면 최대 세기
  kick: 7,           // 카메라가 아래로 눌리는 최대 px
  kickMs: 160,       // 눌렸다 되돌아오는 시간
  shake: 4.5,        // 최대 흔들림 px (연쇄 삭제보다는 약하게)
  dust: 5,           // 충격면 한 칸당 먼지 조각 수
  dustMs: 320,
  dustSize: 3,       // 먼지 한 조각의 픽셀 크기
  dustSpeed: 0.075,  // 튀어 오르는 속도(px/ms)
  gravity: 0.0011,   // 먼지에 걸리는 중력(px/ms^2)
};
