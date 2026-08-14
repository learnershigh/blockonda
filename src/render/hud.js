import { PHASE } from '../game/game.js';

const TIME_NORMAL = '#4cd964';
const TIME_URGENT = '#ff5a5f';

/** 점수 / 설계 남은 시간 / 오버레이 같은 DOM 쪽 UI */
export class Hud {
  constructor({ score, time, overlay }) {
    this.scoreEl = score;
    this.timeEl = time;
    this.overlayEl = overlay;
    this.shownScore = null;
    this.shownTime = null;
  }

  /** 값이 바뀔 때만 DOM을 건드린다 */
  render(game, running) {
    if (this.shownScore !== game.score) {
      this.shownScore = game.score;
      this.scoreEl.textContent = game.score;
    }
    const label = running && !game.over && game.phase === PHASE.DESIGN
      ? game.designSeconds.toFixed(1)
      : '-';
    if (this.shownTime !== label) {
      this.shownTime = label;
      this.timeEl.textContent = label;
      this.timeEl.style.color = label !== '-' && +label <= 1.5 ? TIME_URGENT : TIME_NORMAL;
    }
  }

  showOverlay(title, message) {
    this.overlayEl.innerHTML = `<div class="big">${title}</div><div class="small">${message}</div>`;
    this.overlayEl.classList.remove('hidden');
  }

  hideOverlay() { this.overlayEl.classList.add('hidden'); }

  onOverlayClick(handler) { this.overlayEl.addEventListener('click', handler); }
}
