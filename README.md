# Snake Tetris

뱀처럼 모양을 직접 설계해서 쌓는 테트리스. 빌드 도구 없이 브라우저에서 바로 도는 ES 모듈 웹게임.

플레이: https://learnershigh.github.io/tetris/

## 규칙

- 필드는 가로 10칸 x 세로 21칸. 블록은 맨 위에서 한 칸 떨어진 줄에서 등장한다.
- 블록은 길이 3~6칸의 뱀. **가로 일자**로 등장하며 머리는 바라보는 방향(좌/우 랜덤) 쪽 끝 칸이다.
- 등장 후 **5초 동안 설계 타임**. 방향키로 머리를 조종하면 몸통이 머리가 지나온 경로를 따라온다.
  - 벽 / 쌓인 블록 / 뒤로 가기 → 아무 일도 일어나지 않는다.
  - 목이 아닌 **자기 몸에 부딪히면 페널티** — 그 모양 그대로 굳어 즉시 낙하.
  - SPACE로 조기 확정. 회전은 없다.
- 확정 후에는 ←→ 이동, ↓ 소프트드롭, SPACE 하드드롭만 가능.
- **같은 색 덩어리가 좌우 벽에 모두 닿으면 삭제.** 구불구불해도 4방향으로 이어져 있으면 된다.
- 삭제 후 남은 블록은 **조각 단위(강체)로** 떨어진다. 빈칸을 메우지 않으므로 오버행이 유지된다.
- 낙하로 새 연결이 생기면 연쇄. 배율이 x2, x3...로 올라간다.

## 개발

ES 모듈이라 `file://`로 직접 열면 안 되고 로컬 서버가 필요하다.

```sh
npm start     # http://localhost:8000
npm test      # 단위 테스트 (node 내장 러너, 의존성 없음)
npm run build # itch.io 업로드용 tetris-itch.zip
```

## 구조

```
index.html          마크업 (게임 로직 없음)
css/style.css       화면 스타일
src/
  config.js         규칙/연출 수치 — 밸런스 조정은 여기만
  main.js           진입점: 조립 + 세션 상태(시작/일시정지) + 루프
  loop.js           requestAnimationFrame 루프 (dt 계산)
  input.js          키보드 → 게임 액션
  assets.js         스프라이트 로딩
  game/             ▼ 순수 로직: DOM/캔버스를 전혀 모른다
    game.js         상태 머신(설계/낙하), 스폰, 고정, 점수
    snake.js        뱀 조각 — 설계 이동, 충돌, 낙하 거리
    board.js        필드 그리드, 연결 덩어리 탐색, 강체 중력
    clear.js        삭제 판정 + 연쇄 처리
    dirs.js         방향 벡터 ↔ 저장 코드
  render/           ▼ 그리기 전용: 게임 상태를 읽기만 한다
    renderer.js     필드/뱀/섀도우
    sprites.js      스프라이트 방향(반전·회전) 처리
    effects.js      디졸브 + 흔들림 + 히트스톱
    hud.js          점수/시간/오버레이 DOM
    box-frame.js    UI 패널 9-slice 테두리
    canvas.js       캔버스 초기화
assets/             16x16 도트 스프라이트 — 머리/몸통/코너/꼬리 x 3색
                    원본 기준 자세: 머리는 왼쪽을 보고, 몸통은 가로,
                    코너는 왼쪽↔아래, 꼬리는 왼쪽이 몸통과 이어진다.
                    나머지 방향은 코드에서 회전·반전으로 만든다.
                    Box00.png는 UI 패널 테두리(9-slice). 그림 주위 투명 여백은
                    실행 시 자동으로 잘라내므로, 테두리 두께만 config.js의
                    BOX_FRAME.slice와 맞으면 다른 그림으로 갈아 끼워도 된다.
tests/              단위 테스트 + 부팅 스모크 테스트
```

핵심 원칙은 **`src/game/`은 브라우저 API를 쓰지 않는다**는 것. 덕분에 규칙은 node에서 그대로 테스트할 수 있고,
연출을 바꿔도 규칙이 흔들리지 않는다. 게임은 `onClear` 콜백으로 "무엇이 터졌는지"만 알리고, 연출은 `render/effects.js`가 맡는다.

## 배포

- **GitHub Pages** — `main` 브랜치에 push하면 자동 반영.
- **itch.io** — `npm run build`로 만든 zip을 업로드하고 "This file will be played in the browser" 체크.
  Viewport 700 x 700 권장, 키보드 전용이므로 mobile friendly는 끈다.
