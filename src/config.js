// 게임 규칙/연출 수치를 한곳에 모아둔 곳. 밸런스 조정은 여기만 만지면 된다.

export const COLS = 10;
export const ROWS = 21;
export const CELL = 30;                       // 필드 한 칸의 픽셀 크기
export const SPAWN_ROW = 1;                   // 맨 위에서 한 칸 떨어진 곳에서 등장

export const PREVIEW = { w: 108, h: 84, cell: 15 };

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

/**
 * 난이도 곡선. 기준은 점수 하나뿐이고, 설계 시간과 낙하 속도가 같은 진행도를 따라 함께 조여진다.
 * 0점에서 시작해 full점에 닿으면 최고 난이도가 되며 그 뒤로는 더 빨라지지 않는다.
 * 진행도는 점수에 정비례한다 — full의 절반을 벌면 딱 중간 난이도다.
 */
export const PACE = {
  full: 2500,       // 이 점수에서 최고 난이도 (덩어리 하나 터뜨리면 100점 남짓)
  designMax: 7000,  // 설계 타임(ms): 7초에서
  designMin: 3000,  //                3초까지 줄어든다
  dropMax: 750,     // 한 칸 낙하 간격(ms): 750에서
  dropMin: 90,      //                      90까지 빨라진다
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

// 연쇄 삭제의 박자. 한 번에 다 처리하지 않고 나눠서 보여주기 위한 시간들이다.
// "터진다 → (popMs) → 남은 블록이 한 칸씩 내려온다(fallMs) → (settleMs) → 다음 판정"
// 여기가 0이면 예전처럼 한 프레임에 모든 연쇄가 끝나 버린다.
export const CASCADE = {
  popMs: 160,     // 터진 자리가 빈 채로 멈춰 있는 시간 (히트스톱이 여기에 더 얹힌다)
  fallMs: 45,     // 남은 블록이 한 칸 내려오는 간격
  settleMs: 150,  // 다 내려앉은 모습을 보여주고 나서 다음 연쇄를 판정한다
};

// 연쇄 콤보 표시. 한 조각이 부른 연쇄(CASCADE)가 몇 단계까지 갔는지를 그대로 띄운다.
// 조각마다 한 줄씩 따로 지운 건 아무리 이어져도 콤보가 아니다 — 콤보는 연쇄에서만 터진다.
export const COMBO = {
  min: 2,             // 이 연쇄부터 화면에 띄운다 — 한 번에 그친 삭제는 아직 콤보가 아니다
  y: 0.32,            // 뜨는 높이(필드 높이 대비) — 블록이 쌓이는 아래쪽을 피한다
  size: 22,           // 기본 글자 크기(px) — Galmuri11이라 11의 배수가 가장 또렷하다
  grow: 3,            // 콤보 1당 커지는 px
  maxSize: 44,        // 그래도 이 이상은 커지지 않는다
  font: 'Galmuri11, ui-monospace, monospace', // CSS의 픽셀 폰트를 그대로 캔버스에서도 쓴다
  colors: ['#ffd35c', '#ffa53c', '#ff6b3d', '#ff3d6b'], // min부터 한 칸씩 — 오를수록 뜨거워진다
  outline: '#0d1320', // 필드 배경색으로 두른다 — 쌓인 블록 위에서도 글자가 떠 보인다
  outlineWidth: 5,
  showMs: 900,        // 떠 있는 시간
  rise: 30,           // 그동안 떠오르는 높이(px)
  popMs: 130,         // 나타나는 순간 크게 튀었다 제 크기로 돌아오는 시간
  popScale: 1.6,
  fadeAt: 0.6,        // 수명의 이 지점(0~1)부터 옅어지기 시작한다
};

export const FX = {
  dissolveMs: 420,  // 디졸브 지속
  rowFlashMs: 170,  // 삭제된 줄을 훑는 섬광
  split: 4,         // 한 칸을 4x4 조각으로 쪼갠다
  shakeDecay: 0.05, // ms당 감쇠
  shakeMax: 18,
};

// 설계를 확정한 순간의 연출. 뱀이 하얗게 번쩍이고 몸을 떨며 반짝이가 살짝 튄다.
export const CONFIRM = {
  flashMs: 200,       // 하얗게 번쩍였다 제 색으로 돌아오는 시간
  shake: 3,           // 뱀이 떠는 폭(px) — 화면이 아니라 뱀만 떤다
  shakeMs: 180,       // 떨림이 잦아드는 시간
  glow: 6,            // 밝기 배수 — 가장 어두운 파랑까지 하얗게 뜨도록 넉넉히
  sparks: 3,          // 칸마다 튀는 반짝임 수
  sparkMs: 320,
  sparkSize: 2,       // 반짝임 한 조각의 픽셀 크기
  sparkSpeed: 0.055,  // 튀어 나가는 속도(px/ms) — 반 칸쯤 가고 만다
  gravity: 0.00008,   // 아주 살짝만 가라앉는다
};

// 자기 몸 겹침 페널티 연출. 화면 색은 그대로 두고, 뱀만 붉게 달아오르며 흔들린다.
export const PENALTY = {
  tint: 1,       // 이 동안 쓰는 스프라이트 색 — PALETTE의 빨강(인덱스 0 + 1)
  shake: 7,      // 흔들림 px (착지보다 세게, 연쇄 삭제보다는 약하게)
  flashMs: 260,  // 붉은 기운이 걷히는 시간
  glow: 0.45,    // 같은 그림을 덧그려 달아오르게 하는 세기 (원래 빨간 뱀도 티 나게)
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
