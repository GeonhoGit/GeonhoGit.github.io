# 프로젝트 C · 던전 오토 레기온 파일 안내

브라우저에서 실행하는 던전 자동 전투 게임입니다. [`index.html`](./index.html)이 아래 스크립트를 순서대로 불러온 뒤 `main.js`에서 게임을 시작합니다.

| 파일 | 역할 |
| --- | --- |
| `index.html` | 화면의 기본 구조와 CSS, 게임 스크립트, 광고 스크립트를 연결하는 진입 페이지입니다. |
| `style.css` | 전투·지도·상점·팝업 등 게임 화면의 스타일입니다. |
| `main.js` | 게임 시작, 화면 갱신, 방 이동과 전체 진행 흐름을 조정합니다. |
| `src/data/units.js` | 사용할 수 있는 유닛·직업의 기본 데이터를 정의합니다. |
| `src/data/items.js` | 아이템 종류, 등급과 효과 데이터를 정의합니다. |
| `src/data/config.js` | 게임 밸런스 설정값과 설정 저장·불러오기를 담당합니다. |
| `src/monster/monsters.js` | 등장하는 일반 몬스터와 보스의 기본 데이터를 정의합니다. |
| `src/monster/monsterScaling.js` | 진행 단계에 맞춰 적 능력치를 조정하고 전투용 적을 생성합니다. |
| `src/utils.js` | 유닛 능력치·피해량 계산, 확률 추첨, 던전 지도 생성 등 공통 함수를 모았습니다. |
| `src/combat/combat.js` | 자동 전투, 공격·스킬·상태 이상, 전투 결과 처리를 담당합니다. |
| `src/ui/ui.js` | 인벤토리, 획득 확률 안내, 공통 팝업과 패널을 그립니다. |
| `src/ui/card.js` | 유닛 카드와 상세 능력치 표시를 만듭니다. |
| `src/ui/squad.js` | 보유 유닛·출전 유닛 관리, 배치, 합성 및 회복을 처리합니다. |
| `src/system/save.js` | 브라우저의 게임 진행과 영구 기록을 저장·불러옵니다. |
| `src/system/synergy.js` | 출전 유닛 조합에서 생기는 시너지 효과를 계산합니다. |
| `src/system/gemSystem.js` | 보석을 사용하는 영구 성장 시스템을 처리합니다. |
| `src/Re/recombination.js` | 유닛 재조합 선택 화면과 결과 처리를 담당합니다. |
| `src/rooms/map.js` | 이동할 던전 경로와 방 선택 화면을 관리합니다. |
| `src/rooms/shop.js` | 상점 상품 표시, 구매, 새로고침과 업그레이드를 처리합니다. |
| `src/rooms/reward.js` | 전투 보상과 아이템 선택 화면을 처리합니다. |
| `src/rooms/rest.js` | 휴식 방에서 선택할 회복·강화 행동을 처리합니다. |
| `src/rooms/event.js` | 이벤트 방의 선택지와 결과를 처리합니다. |
| `src/rooms/gameover.js` | 패배·게임 종료 화면과 부활 선택을 처리합니다. |
| `ads.txt` | 광고 제공자 확인용 텍스트 파일입니다. |
| `package.json` | 개발용 npm 패키지 정보와 의존성을 적습니다. |
| `package-lock.json` | 설치할 npm 의존성의 정확한 버전을 고정합니다. |
| `.gitignore` | Git에서 추적하지 않을 개발 파일과 폴더를 지정합니다. |
| `README.md` | 게임 특징과 실행·개발 정보를 적은 기존 설명서입니다. |
| `FILES.md` | 이 파일별 역할 안내문입니다. |
