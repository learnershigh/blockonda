import { SOUND } from './config.js';

/**
 * 게임 이벤트에 붙는 효과음과 배경음악.
 *
 * 브라우저 API(Audio)를 쓰므로 game/ 바깥에 있고, main.js가 EVENT를 그대로 넘겨준다.
 * 소리 하나당 태그 하나만 두고 다시 틀 때 앞소리를 끊는다 — 키를 연타해도 겹쳐 쌓이지 않는다.
 * Audio가 없는 환경(노드 테스트)이나 파일을 못 불러온 경우에는 조용히 아무 일도 하지 않는다.
 */
export class Sound {
  constructor({ create = createAudio, muted = false } = {}) {
    this.muted = muted;
    this.musicOn = false;
    this.tracks = new Map();
    for (const [event, { file, volume }] of Object.entries(SOUND.events)) {
      const el = create(SOUND.base + file);
      if (!el) continue;
      el.preload = 'auto';
      el.volume = Math.min(1, volume * SOUND.master);
      this.tracks.set(event, el);
    }

    this.music = create(SOUND.base + SOUND.music.file) || null;
    if (this.music) {
      this.music.loop = true; // 끝나면 처음부터 다시 — 무한 반복
      this.music.preload = 'auto';
      this.music.volume = Math.min(1, SOUND.music.volume * SOUND.master);
    }
  }

  play(event) {
    if (this.muted) return;
    const el = this.tracks.get(event);
    if (!el) return;
    try {
      el.currentTime = 0;
      // 첫 입력 전에는 브라우저가 재생을 막는다 — 게임 진행과는 무관하니 삼킨다
      el.play()?.catch?.(() => {});
    } catch { /* 재생 실패가 게임을 멈추게 두지 않는다 */ }
  }

  /**
   * 배경음악을 틀거나 멈춘다. main.js가 매 프레임 게임이 도는지 넘겨주므로
   * 상태가 바뀔 때만 실제로 건드린다. 멈춰도 되감지 않아 이어서 재생된다.
   */
  setMusic(on) {
    if (on === this.musicOn) return;
    this.musicOn = on;
    this.#syncMusic();
  }

  /** 소리를 끄면 지금 울리고 있는 것도 멈춘다 */
  setMuted(muted) {
    this.muted = muted;
    if (muted) {
      for (const el of this.tracks.values()) {
        try { el.pause(); } catch { /* 무시 */ }
      }
    }
    this.#syncMusic();
  }

  #syncMusic() {
    if (!this.music) return;
    try {
      if (this.musicOn && !this.muted) this.music.play()?.catch?.(() => {});
      else this.music.pause();
    } catch { /* 재생 실패는 게임 진행과 무관하다 */ }
  }
}

function createAudio(src) {
  if (typeof Audio === 'undefined') return null;
  return new Audio(src);
}
