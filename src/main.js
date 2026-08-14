import { loadSprites } from './assets.js';
import { CELL, COLS, PREVIEW, ROWS } from './config.js';
import { Game } from './game/game.js';
import { bindKeys } from './input.js';
import { startLoop } from './loop.js';
import { createContext } from './render/canvas.js';
import { Effects } from './render/effects.js';
import { Hud } from './render/hud.js';
import { drawBoard, drawPreview } from './render/renderer.js';

const TITLE = 'TETRIS';
const INTRO = '블록이 나오면 <b>5초</b> 동안 방향키로 머리를 움직여 모양 설계!<br>'
  + '같은 색 덩어리가 좌우 벽에 모두 닿으면 삭제!<br>클릭 또는 아무 키나 눌러 시작';

loadSprites();

const boardCtx = createContext(document.getElementById('board'), COLS * CELL, ROWS * CELL);
const previewCtx = createContext(document.getElementById('next'), PREVIEW.w, PREVIEW.h);
const hud = new Hud({
  score: document.getElementById('score'),
  time: document.getElementById('time'),
  overlay: document.getElementById('overlay'),
});

const effects = new Effects();
const game = new Game({ onClear: rounds => effects.spawn(rounds) });

// 세션 상태 — 게임 규칙이 아니라 화면 흐름에 대한 것
let started = false;
let paused = false;

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
startLoop(dt => {
  effects.update(dt);
  const running = started && !paused && !game.over;
  if (running && !effects.frozen) game.update(dt);

  if (game.over && !wasOver) endGame();
  wasOver = game.over;

  drawBoard(boardCtx, game, effects);
  drawPreview(previewCtx, game.next);
  hud.render(game, started && !paused);
});
