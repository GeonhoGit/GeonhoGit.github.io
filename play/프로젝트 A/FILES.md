# 프로젝트 A · 차곡냥 파일 안내

같은 고양이 네 마리를 상자에 모으는 퍼즐 게임의 **웹 배포본**입니다. 브라우저에서는 [`index.html`](./index.html)을 엽니다. `assets/`의 해시가 붙은 파일은 빌드 결과물이므로 수정할 때는 원본 프로젝트에서 다시 빌드하는 편이 안전합니다.

| 파일 | 역할 |
| --- | --- |
| `.nojekyll` | 원본 웹 배포본에 포함된 Jekyll 건너뛰기 표시 파일입니다. 이 포트폴리오의 하위 폴더에서는 사이트 루트 설정으로 적용되지 않습니다. |
| `index.html` | 게임의 진입 페이지로, 화면의 기본 구조를 만들고 JavaScript·CSS·아이콘·앱 설치 정보를 연결합니다. |
| `assets/index-Dkcezj7B.js` | 퍼즐 규칙, 화면 전환, 진행 저장 등 게임 본체가 묶인 JavaScript입니다. |
| `assets/index-DGGX_FkO.css` | 게임 화면과 반응형 배치에 적용되는 묶음 스타일입니다. |
| `assets/worker-BTLdJPFI.js` | 화면을 멈추지 않고 무한 모드 퍼즐 단계를 생성하는 Web Worker입니다. |
| `assets/web-CHBAtjMH.js` | 웹 환경에서 광고 관련 호출을 대신 처리하는 AdMob 연결 코드입니다. |
| `assets/web-t5da_zRI.js` | 브라우저에서 앱 상태·언어 등 Capacitor 앱 기능을 연결하는 코드입니다. |
| `assets/tiny-paw-walk-C4JqHXI_.ogg` | 게임 배경음의 OGG 파일입니다. |
| `assets/tiny-paw-walk-fallback-85CWDzSq.mp3` | OGG 재생을 지원하지 않는 환경을 위한 MP3 배경음입니다. |
| `sw.js` | 방문한 뒤에도 게임을 열 수 있도록 배포 파일을 캐시하는 서비스 워커입니다. |
| `manifest.webmanifest` | 홈 화면 설치 시 사용할 앱 이름, 시작 위치, 아이콘 등을 지정합니다. |
| `icon.svg` | 웹 페이지와 앱에서 사용하는 벡터 아이콘입니다. |
| `icon-192.png` | 설치용 192px 앱 아이콘입니다. |
| `icon-512.png` | 설치용 512px 앱 아이콘입니다. |
| `build-profile.json` | 웹 빌드 모드와 광고 테스트 설정 등을 기록한 빌드 프로필입니다. |
| `README.md` | 게임 소개, 조작법, 저장 방식과 배포 정보를 적은 설명서입니다. |
| `FILES.md` | 이 파일별 역할 안내문입니다. |
