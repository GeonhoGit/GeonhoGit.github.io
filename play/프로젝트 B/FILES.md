# 프로젝트 B · 저주받은 유물 사냥꾼 파일 안내

3D 액션 게임의 **웹 배포본**입니다. [`index.html`](./index.html)을 열면 실행됩니다. 해시가 붙은 `assets/` 파일은 여러 원본 파일을 합쳐 만든 결과물입니다.

| 파일 | 역할 |
| --- | --- |
| `index.html` | 게임 진입 페이지로, 실행할 JavaScript와 CSS 파일을 불러옵니다. |
| `assets/index-CSIqjxq3.js` | 유물 57종·도감·키 변경·정예 웨이브·밸런스·성능·저장 및 충돌 수정이 포함된 3D 게임 실행 코드입니다. |
| `assets/index-DcHgVl8l.css` | 게임 화면과 도감·키 변경·유물 효과 안내 UI의 스타일을 묶은 파일입니다. |
| `models/weapons/w01.glb` | 현재 사용하는 유물 사수기 3D 모델입니다. |
| `models/weapons/w02.glb` | 현재 사용하는 산탄 성물 3D 모델입니다. |
| `models/weapons/w03.glb` | 현재 사용하는 관측자의 쇠뇌 3D 모델입니다. |
| `models/weapons/w04.glb` | 현재 사용하는 균열 지팡이 3D 모델입니다. |
| `FILES.md` | 이 파일별 역할 안내문입니다. |

원본 소스는 [cursed-relic-hunter-3d 저장소](https://github.com/GeonhoGit/cursed-relic-hunter-3d)에서 확인할 수 있습니다.

2026-10-09 갱신: 지역당13방·정예방 다중 웨이브, 렌더 자원 공유·효과 예열, 산탄 성물·균열 지팡이 조정과 저장 복구·이전 탐험·점프/탄환 충돌·메뉴 키보드 탐색을 반영했습니다. 저장 콘텐츠 버전은 `prototype-0.16`이며 기존0.1~0.15 기록을 지원합니다. 원본 실행 코드 기준 커밋은 `e5c0cea5e8fa735c1c9481590e354dea1eb55e90`입니다.

캐릭터·보스 15종과 투사체 16종의 새 Blender 검토본은 원본 저장소의 [art/](https://github.com/GeonhoGit/cursed-relic-hunter-3d/tree/main/art)에 보관합니다. 이 실행판에는 아직 적용하지 않았습니다.
