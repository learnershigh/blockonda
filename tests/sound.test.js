import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SOUND } from '../src/config.js';
import { EVENT } from '../src/game/game.js';
import { Sound } from '../src/sound.js';

/** Audio 대신 쓰는 가짜 태그. 재생 호출을 순서대로 기록한다. */
function fakeAudio() {
  const made = [];
  const create = src => {
    const el = {
      src, volume: 1, preload: '', currentTime: 7, plays: 0, paused: false,
      play() { el.plays++; el.paused = false; return Promise.resolve(); },
      pause() { el.paused = true; },
    };
    made.push(el);
    return el;
  };
  return { create, made };
}

describe('Sound', () => {
  it('EVENT와 소리 파일이 빠짐없이 짝을 이룬다', () => {
    const events = Object.values(EVENT).sort();
    assert.deepEqual(Object.keys(SOUND.events).sort(), events);
  });

  it('이벤트마다 해당 소리를 처음부터 다시 튼다', () => {
    const { create, made } = fakeAudio();
    const sound = new Sound({ create });
    assert.equal(made.length, Object.keys(SOUND.events).length + 1, '효과음 + 배경음악');

    sound.play(EVENT.LAND);
    const landing = made.find(el => el.src.endsWith('Landing.wav'));
    assert.equal(landing.plays, 1);
    assert.equal(landing.currentTime, 0, '연타해도 앞소리를 끊고 다시 시작');
    assert.ok(made.every(el => el === landing || el.plays === 0), '다른 소리는 울리지 않는다');
  });

  it('볼륨은 master를 곱해 0~1 안에 들어간다', () => {
    const { create, made } = fakeAudio();
    new Sound({ create });
    assert.ok(made.every(el => el.volume > 0 && el.volume <= 1));
    const move = made.find(el => el.src.endsWith('Move.wav'));
    assert.equal(move.volume, SOUND.events[EVENT.MOVE].volume * SOUND.master);
  });

  it('음소거하면 울리지 않고, 울리던 소리도 멈춘다', () => {
    const { create, made } = fakeAudio();
    const sound = new Sound({ create });
    sound.play(EVENT.OVER);
    sound.setMuted(true);
    sound.play(EVENT.OVER);

    const over = made.find(el => el.src.endsWith('GameOver.wav'));
    assert.equal(over.plays, 1, '음소거 뒤에는 재생되지 않는다');
    assert.ok(over.paused);

    sound.setMuted(false);
    sound.play(EVENT.OVER);
    assert.equal(over.plays, 2);
  });

  it('Audio가 없는 환경에서도 조용히 넘어간다', () => {
    const sound = new Sound({ create: () => null });
    assert.doesNotThrow(() => sound.play(EVENT.SPAWN));
    assert.doesNotThrow(() => sound.setMuted(true));
    assert.doesNotThrow(() => sound.setMusic(true));
  });
});

describe('배경음악', () => {
  const setup = () => {
    const { create, made } = fakeAudio();
    const sound = new Sound({ create });
    return { sound, music: made.find(el => el.src.endsWith(SOUND.music.file)) };
  };

  it('무한 반복으로 준비되고, 시작 전에는 울리지 않는다', () => {
    const { music } = setup();
    assert.ok(music.loop, '끝나면 처음부터 다시');
    assert.equal(music.plays, 0);
    assert.equal(music.volume, SOUND.music.volume * SOUND.master);
  });

  it('게임이 도는 동안만 흐르고, 멈췄다 켜도 되감지 않는다', () => {
    const { sound, music } = setup();
    sound.setMusic(true);
    sound.setMusic(true); // 매 프레임 불려도 다시 틀지 않는다
    assert.equal(music.plays, 1);

    music.currentTime = 42;
    sound.setMusic(false);
    assert.ok(music.paused);
    sound.setMusic(true);
    assert.equal(music.plays, 2);
    assert.equal(music.currentTime, 42, '멈춘 자리에서 이어진다');
  });

  it('음소거하면 멈추고, 풀면 게임이 도는 중일 때만 다시 흐른다', () => {
    const { sound, music } = setup();
    sound.setMusic(true);
    sound.setMuted(true);
    assert.ok(music.paused);

    sound.setMuted(false);
    assert.equal(music.plays, 2, '게임이 도는 중이었으니 다시 흐른다');

    sound.setMusic(false);
    sound.setMuted(true);
    sound.setMuted(false);
    assert.equal(music.plays, 2, '멈춰 있었다면 음소거를 풀어도 조용하다');
  });
});
