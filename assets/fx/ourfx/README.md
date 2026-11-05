# 우리가 직접 그린 효과 (ourfx)

이 폴더의 그림은 전부 **우리 코드(ourfx.js)가 한 점씩 직접 그린 도트 효과**입니다.
외부 효과 그림·코드는 쓰지 않았습니다.

- 그린 코드: `pixel-brawler\pipeline\ourfx\ourfx.js` (게임 폴더 밖, git 에 안 올림)
- 굽는 법: 그 폴더에서 `node render.js` → `out\frames\<이름>\<이름>_01.png …` 를 여기에 복사
- 크기 = 게임 도트 그대로(화면 높이 240 기준 1점). 게임은 이 그림을 **1배, 부드럽게 하기 끔**으로 그립니다
  (config.js `skillFx` 의 `ours` 항목, assets.js 가 줄이거나 키우지 않음).
- 모든 그림은 오른쪽을 보고 그림(왼쪽은 게임에서 좌우 뒤집기).
- 9단계 장군 화염 고리는 그림 파일이 아니라 `js/fxdraw.js` 가 매 장면 코드로 그립니다(같은 ourfx 의 novaRing).
