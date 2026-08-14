import { ACTION } from './game/game.js';

const KEY_MAP = {
  ArrowLeft: ACTION.LEFT,
  ArrowRight: ACTION.RIGHT,
  ArrowUp: ACTION.UP,
  ArrowDown: ACTION.DOWN,
  Space: ACTION.SPACE,
};
const OWNED_KEYS = [...Object.keys(KEY_MAP), 'Enter'];

/**
 * 키보드를 게임 액션으로 바꿔 넘긴다.
 * handler({ action, code, repeat }) — action이 없으면 게임 조작이 아닌 키.
 */
export function bindKeys(target, handler) {
  const onKeyDown = event => {
    if (OWNED_KEYS.includes(event.code)) event.preventDefault();
    handler({ action: KEY_MAP[event.code] || null, code: event.code, repeat: event.repeat });
  };
  target.addEventListener('keydown', onKeyDown);
  return () => target.removeEventListener('keydown', onKeyDown);
}
