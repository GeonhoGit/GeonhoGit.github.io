# Geonho의 작업실

GeonhoGit의 공개 프로젝트 14개를 한곳에서 살펴보는 홈페이지입니다. 웹 작품 8개는 사이트 안에서 실행하고, 나머지는 GitHub의 공개 파일 목록과 내용을 불러와 보여줍니다. `home` 저장소는 포함하지 않습니다.

## 구조

- `src/catalog.js`: 프로젝트 이름, 설명, 분류, 저장소, 기본 브랜치, 실행 주소
- `src/app.js`: 목록, 검색, 상세 화면, 실행 화면, 파일 탐색기
- `play/`: GitHub Pages에서 실행할 수 있도록 복사하거나 빌드한 웹 작품. [A–H 이름표](play/README.md)를 참고하세요.
- `style.css`: 홈페이지 디자인

## 앞으로 프로젝트 올리는 방법

**파일만 이 저장소에 업로드하면 홈페이지 목록에는 자동으로 나타나지 않습니다.** `play/`는 실행 화면용 파일을 두는 곳이고, 홈페이지의 카드와 파일 보기 연결은 `src/catalog.js`에서 관리합니다. 이 저장소는 공개되어 있으므로 비밀번호, API 키, `.env`, 개인 자료는 올리지 마세요.

### 웹에서 실행되는 게임·사이트

1. 원본 코드를 별도 **공개 GitHub 저장소**에 올리거나 기존 원본 저장소를 갱신합니다. 홈페이지의 **파일 보기**는 이 원본 저장소에서 파일을 읽습니다.
2. 이 저장소의 `play/`에 다음 이름의 폴더를 만듭니다. 현재 A–H를 사용 중이므로 다음 웹 작품은 **`play/프로젝트 I/`**입니다. 이후에는 J, K 순서로 붙입니다.
3. 새 폴더의 바로 아래에 실행용 `index.html`을 놓고 필요한 CSS, JavaScript, 이미지 등의 파일을 함께 넣습니다. 빌드가 필요한 작품은 빌드 결과물만 넣고, 파일 경로가 `./`처럼 상대 경로가 되도록 빌드합니다. `node_modules`나 개발용 빌드 캐시는 넣지 않습니다.
4. `src/catalog.js`의 `projects` 배열에 아래와 같은 항목을 추가합니다. `repo`와 `branch`는 **원본 저장소의 실제 이름과 브랜치**로 바꾸고, `id`는 다른 카드와 겹치지 않는 영문 소문자·하이픈 이름으로 정합니다.

   ```js
   {
     id: 'new-game', repo: 'new-game', branch: 'main',
     title: '새 게임의 한글명', eyebrow: '게임 종류', category: 'web',
     description: '어떤 게임인지 한 문장으로 소개합니다.',
     tags: ['HTML', '게임'], icon: '✦', tone: 'blue',
     preview: 'play/프로젝트 I/index.html',
   },
   ```

5. [`play/README.md`](play/README.md) 이름표에 `프로젝트 I | 한글명 | 원본 저장소` 행을 추가합니다. GitHub 폴더 목록의 옆 칸에도 한글명이 보이길 원한다면 해당 폴더를 올릴 때 커밋 메시지를 한글명으로 적습니다. 이 칸은 최근 커밋 메시지이므로 나중에 바뀔 수 있습니다.
6. 브라우저에 예전 목록이 남지 않도록 `index.html`의 `style.css?v=3`, `src/app.js?v=3`과 `src/app.js`의 `catalog.js?v=3`에 붙은 숫자를 **모두 같은 다음 숫자**로 올립니다. 예: `3` → `4`.

### 모바일 앱·PC 프로그램처럼 웹에서 실행할 수 없는 작업

원본을 별도 공개 GitHub 저장소에 올리고 `src/catalog.js`에 같은 방식으로 항목을 추가합니다. `category`는 `mobile` 또는 `experiment` 중 맞는 값을 쓰고 `preview: null`로 둡니다. `play/` 폴더는 만들지 않습니다. 카드를 선택하면 원본 저장소의 파일 목록과 내용이 열립니다. 기존 프로젝트 A–H를 수정하는 경우에는 새 글자를 만들지 말고 해당 폴더의 파일과 카탈로그 정보만 갱신합니다.

### 변경 사항을 GitHub에 반영

이미 내려받은 이 저장소의 로컬 폴더에서 작업합니다. **파일을 수정하기 전** 최신 내용을 받고, 수정한 뒤 검증하고 올립니다. 아래 명령은 해당 폴더에서 실행합니다.

```bash
git pull --ff-only origin main
# 위 절차대로 파일 수정
npm test
git status
git add -A
git commit -m "새 게임의 한글명"
git push origin main
```

`git status`에서 올릴 파일을 확인한 뒤 `git add -A`를 실행하세요. 이 저장소는 `main` 브랜치의 루트에서 GitHub Pages를 배포하므로 푸시하면 [홈페이지](https://geonhogit.github.io/)가 갱신됩니다. 반영이 늦거나 실패하면 저장소의 **Actions → pages-build-deployment**를 확인합니다. 브라우저에서 직접 올릴 때는 저장소의 **Add file → Upload files**로 파일이나 폴더를 추가하고, `src/catalog.js`도 편집해야 합니다. [GitHub의 파일 업로드 안내](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)를 참고하세요.

파일 보기는 GitHub API와 공개 원본 파일 주소에서 실시간으로 읽습니다. API 요청 제한이나 네트워크 오류가 나면 GitHub 원본 링크를 사용할 수 있습니다. 파일 크기가 1MB를 넘거나 브라우저에서 표시하기 어려운 형식은 GitHub에서 열도록 안내합니다.

## 로컬 확인

정적 웹 서버로 이 폴더를 제공하면 됩니다. 예를 들어 Node.js 20 이상에서 `npx serve .`를 실행하고 안내된 주소를 엽니다. 모델 함수 검증은 `npm test`로 실행합니다.
