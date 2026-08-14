import { loadSprites } from './assets.js';
import { BOX_FRAME, CELL, COLS, PREVIEW, ROWS } from './config.js';
import { EVENT, Game, PHASE } from './game/game.js';
import { bindKeys } from './input.js';
import { startLoop } from './loop.js';
import { applyBoxFrame } from './render/box-frame.js';
import { createContext } from './render/canvas.js';
import { Effects } from './render/effects.js';
import { Hud } from './render/hud.js';
import { drawBoard, drawPreview } from './render/renderer.js';
import { Sound } from './sound.js';

const TITLE = 'BLOCKONDA';
const INTRO = '블록이 나오면 <b>7초</b> 동안 방향키로 머리를 움직여 모양 설계!<br>'
  + '같은 색 덩어리가 좌우 벽에 모두 닿으면 삭제!<br>'
  + '점수가 오를수록 설계 시간은 3초까지 줄고 낙하는 빨라진다<br>클릭 또는 아무 키나 눌러 시작';

loadSprites();
// 실패해도 게임은 그대로 — 패널이 기본 테두리로 남을 뿐이다
applyBoxFrame(BOX_FRAME.src, BOX_FRAME).catch(() => {});

const boardCtx = createContext(document.getElementById('board'), COLS * CELL, ROWS * CELL);
const previewCtx = createContext(document.getElementById('next'), PREVIEW.w, PREVIEW.h);
const hud = new Hud({
  score: document.getElementById('score'),
  time: document.getElementById('time'),
  overlay: document.getElementById('overlay'),
});

// 세션 상태 — 게임 규칙이 아니라 화면 흐름에 대한 것
// (Game 생성 중에도 첫 스폰 이벤트가 올라오므로 콜백보다 먼저 선언해야 한다)
let started = false;
let paused = false;

const effects = new Effects();
const sound = new Sound();

// 게임이 알려주는 사건 하나가 연출과 소리로 갈라진다
const game = new Game({
  onEvent: (type, data) => {
    if (type === EVENT.CLEAR) effects.spawn(data);
    else if (type === EVENT.LAND) {
      effects.impact(data);
      effects.endPenalty(); // 붉은 뱀이 굳는 순간 — 그 색은 다음 조각의 것이 아니다
    } else if (type === EVENT.SELF_HIT) effects.penalty();
    if (started) sound.play(type); // 시작 전 첫 스폰까지 울리지는 않게
  },
});

function startGame() {
  started = true;
  paused = false;
  hud.hideOverlay();
}

function restart() {
  game.reset();
  effects.clear();
  startGame();
}

function resume() {
  paused = false;
  hud.hideOverlay();
}

function pause() {
  paused = true;
  hud.showOverlay('PAUSED', '클릭해서 계속');
}

function endGame() {
  hud.showOverlay('GAME OVER', `SCORE ${game.score}<br>Enter 키로 다시 시작`);
}

hud.showOverlay(TITLE, INTRO);

bindKeys(document, ({ action, code, repeat }) => {
  if (code === 'KeyM') return sound.setMuted(!sound.muted); // 언제든 소리 끄고 켜기
  if (game.over) {
    if (code === 'Enter') restart();
    return;
  }
  if (!started) return startGame();
  if (paused) return resume();
  if (repeat && code === 'Space') return; // 꾹 눌러도 한 번만
  if (action) game.input(action);
});

hud.onOverlayClick(() => {
  if (game.over) return restart();
  if (!started) return startGame();
  if (paused) resume();
});

// iframe(itch.io)에서 포커스를 잃으면 억울하게 죽지 않도록 멈춘다
window.addEventListener('blur', () => {
  if (started && !game.over && !paused) pause();
});

let wasOver = false;
let wasDesign = game.phase === PHASE.DESIGN;
startLoop(dt => {
  effects.update(dt);
  const running = started && !paused && !game.over;
  sound.setMusic(running); // 일시정지/게임오버에는 멈췄다가 이어서 다시
  if (running && !effects.frozen) game.update(dt);

  // 설계 → 낙하로 넘어간 순간이 곧 "모양 확정"이다. SPACE로 끝내든 시간이 다 되든 여기로 모인다.
  // 자기 몸을 밟아 굳은 거라면 붉은 기운이 이미 올라와 있으니 흰 빛으로 덮지 않는다.
  const designing = game.phase === PHASE.DESIGN;
  if (wasDesign && !designing && !effects.penaltyFlash) effects.confirm(game.snake.cells);
  wasDesign = designing;

  if (game.over && !wasOver) endGame();
  wasOver = game.over;

  drawBoard(boardCtx, game, effects);
  drawPreview(previewCtx, game.next);
  hud.render(game, started && !paused);
});
