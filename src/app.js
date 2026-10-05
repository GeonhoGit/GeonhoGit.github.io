import { projects } from './catalog.js';
import { defaultTab, filterProjects, githubFileUrl, initialFile, rawFileUrl } from './model.js';

const root = document.querySelector('#app');
const treeCache = new Map();
let category = 'all';
let query = '';
let activeProject = null;
let activeTab = null;
let selectedFile = null;
let fileQuery = '';

const categoryLabels = { all: '전체', web: '웹에서 실행', mobile: '모바일 앱', experiment: '작은 실험' };
const textExtensions = new Set(['md', 'txt', 'html', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'yaml', 'yml', 'dart', 'java', 'kt', 'xml', 'gradle', 'properties', 'cjs', 'mjs', 'sh', 'bat', 'ps1', 'svg', 'py', 'toml', 'lock', 'gitignore']);
const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg']);

function html(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function repoUrl(project) {
  return `https://github.com/GeonhoGit/${encodeURIComponent(project.repo)}`;
}

function parseProjectRoute() {
  const match = location.hash.match(/^#project\/([a-z0-9-]+)$/);
  return match ? projects.find(project => project.id === match[1]) : null;
}

function cardMarkup(project, index) {
  const mode = project.preview ? '바로 실행' : '파일 살펴보기';
  return `<a class="project-card tone-${html(project.tone)} ${project.featured ? 'featured' : ''}" href="#project/${html(project.id)}" aria-label="${html(project.title)} 자세히 보기">
    <div class="card-art" aria-hidden="true"><span class="card-orbit orbit-one"></span><span class="card-orbit orbit-two"></span><span class="card-icon">${html(project.icon)}</span><span class="card-number">${String(index + 1).padStart(2, '0')}</span></div>
    <div class="card-body"><div class="card-topline"><span>${html(project.eyebrow)}</span><span class="card-arrow" aria-hidden="true">↗</span></div>
    <h3>${html(project.title)}</h3><p>${html(project.description)}</p>
    <div class="card-bottom"><span class="mode-pill"><span class="mode-dot"></span>${mode}</span><span class="card-tags">${project.tags.slice(0, 2).map(tag => html(tag)).join(' · ')}</span></div></div>
  </a>`;
}

function renderCards() {
  const matches = filterProjects(projects, query, category);
  const grid = document.querySelector('#project-grid');
  const result = document.querySelector('#result-count');
  if (!grid || !result) return;
  result.textContent = `${matches.length}개의 작업`;
  grid.innerHTML = matches.length
    ? matches.map(project => cardMarkup(project, projects.indexOf(project))).join('')
    : '<div class="empty-results"><span aria-hidden="true">⌕</span><h3>검색 결과가 없어요</h3><p>다른 단어나 분류로 다시 찾아보세요.</p></div>';
}

function renderHome() {
  activeProject = null;
  document.title = 'Geonho의 작업실 · 게임과 앱 모음';
  const webCount = projects.filter(project => project.preview).length;
  root.innerHTML = `<section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy"><div class="eyebrow-line"><span class="pulse-dot"></span> CREATIVE ARCHIVE / 2026</div>
    <h1 id="hero-title">아이디어가<br><em>화면이 되는 곳<span class="period">.</span></em></h1>
    <p class="hero-description">게임을 만들고, 앱을 다듬고, 가끔은 작은 호기심을 코드로 남깁니다. 지금까지 만든 작업을 한곳에서 열어보세요.</p>
    <a class="hero-button" href="#works">작업 둘러보기 <span aria-hidden="true">↘</span></a></div>
    <div class="hero-visual" aria-hidden="true"><div class="hero-window"><div class="window-top"><span></span><span></span><span></span><b>WORK IN PROGRESS</b></div><div class="window-display"><div class="display-grid"></div><span class="display-glyph">G</span><span class="display-cross cross-one">+</span><span class="display-cross cross-two">+</span><span class="display-caption">PLAY · BUILD · REPEAT</span></div><div class="window-footer"><span>GEONHO / WORKSHOP</span><span>001 — 014</span></div></div><span class="visual-spark spark-one">✳</span><span class="visual-spark spark-two">✦</span></div>
  </section>
  <section class="stat-row" aria-label="작업 통계"><div><strong>${projects.length.toString().padStart(2, '0')}</strong><span>전체 프로젝트</span></div><div><strong>${webCount.toString().padStart(2, '0')}</strong><span>바로 실행 가능</span></div><div><strong>∞</strong><span>계속 이어지는 작업</span></div></section>
  <section id="works" class="works-section" aria-labelledby="works-title"><div class="section-heading"><div><div class="section-kicker">THE COLLECTION <span>↗</span></div><h2 id="works-title">만든 것들<span class="period">.</span></h2></div><p>마음에 드는 작업을 골라 직접 열어보세요.</p></div>
  <div class="toolbar"><div class="filter-group" role="group" aria-label="프로젝트 분류">${Object.entries(categoryLabels).map(([key, label]) => `<button type="button" class="filter-button ${category === key ? 'active' : ''}" data-category="${key}" aria-pressed="${category === key}">${label}</button>`).join('')}</div><label class="search-box"><span aria-hidden="true">⌕</span><span class="sr-only">프로젝트 검색</span><input id="project-search" type="search" placeholder="프로젝트 검색" value="${html(query)}" autocomplete="off"></label></div>
  <div class="results-line"><span id="result-count"></span><span class="line-rule"></span><span>SELECT A PROJECT</span></div><div id="project-grid" class="project-grid"></div></section>`;
  document.querySelector('#project-search').addEventListener('input', event => { query = event.target.value; renderCards(); });
  document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
    category = button.dataset.category;
    document.querySelectorAll('[data-category]').forEach(item => {
      const isActive = item.dataset.category === category;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-pressed', String(isActive));
    });
    renderCards();
  }));
  renderCards();
}

function renderDetail(project) {
  activeProject = project;
  activeTab = defaultTab(project);
  selectedFile = null;
  fileQuery = '';
  document.title = `${project.title} · Geonho의 작업실`;
  root.innerHTML = `<section class="detail" aria-labelledby="detail-title">
    <a class="back-link" href="#works"><span aria-hidden="true">←</span> 모든 작업으로</a>
    <div class="detail-heading"><div class="detail-icon tone-${html(project.tone)}" aria-hidden="true">${html(project.icon)}</div><div class="detail-intro"><div class="detail-eyebrow">${html(project.eyebrow)} <span> / ${html(project.repo)}</span></div><h1 id="detail-title">${html(project.title)}<span class="period">.</span></h1><p>${html(project.description)}</p><div class="detail-tags">${project.tags.map(tag => `<span>${html(tag)}</span>`).join('')}</div></div></div>
    <div class="detail-actions"><a href="${repoUrl(project)}" target="_blank" rel="noopener noreferrer">GitHub 원본 <span aria-hidden="true">↗</span></a>${project.preview ? `<a href="${html(project.preview)}" target="_blank" rel="noopener noreferrer">새 탭에서 실행 <span aria-hidden="true">↗</span></a>` : ''}</div>
    <div class="workspace-header"><div class="tab-list" role="tablist" aria-label="작업 보기">${project.preview ? `<button type="button" role="tab" data-tab="preview" aria-selected="${activeTab === 'preview'}" class="${activeTab === 'preview' ? 'selected' : ''}">▶ <span>실행 화면</span></button>` : ''}<button type="button" role="tab" data-tab="files" aria-selected="${activeTab === 'files'}" class="${activeTab === 'files' ? 'selected' : ''}">⌘ <span>파일 보기</span></button></div><span class="workspace-label">${project.preview ? 'LIVE PREVIEW / SOURCE' : 'SOURCE EXPLORER'}</span></div>
    <div id="workspace" class="workspace" role="tabpanel"></div>
  </section>`;
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
    activeTab = button.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach(item => {
      const selected = item.dataset.tab === activeTab;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-selected', String(selected));
    });
    renderWorkspace(project);
  }));
  renderWorkspace(project);
}

function renderWorkspace(project) {
  const workspace = document.querySelector('#workspace');
  if (!workspace || activeProject?.id !== project.id) return;
  if (activeTab === 'preview') {
    workspace.innerHTML = `<div class="preview-toolbar"><span><span class="live-dot"></span> LIVE PREVIEW</span><span>${html(project.repo)}</span><a href="${html(project.preview)}" target="_blank" rel="noopener noreferrer">전체 화면 ↗</a></div><iframe class="preview-frame" title="${html(project.title)} 실행 화면" src="${html(project.preview)}" loading="eager" allow="fullscreen; gamepad; autoplay" allowfullscreen></iframe>`;
    return;
  }
  workspace.innerHTML = `<div class="file-layout"><aside class="file-sidebar" aria-label="프로젝트 파일"><div class="file-sidebar-head"><span class="folder-symbol" aria-hidden="true">▤</span><strong>${html(project.repo)}</strong><span id="file-count"></span></div><label class="file-search"><span class="sr-only">파일 검색</span><input id="file-search" type="search" placeholder="파일 이름 찾기" autocomplete="off" value="${html(fileQuery)}"></label><div id="file-list" class="file-list"><div class="file-status">파일 목록을 불러오는 중…</div></div></aside><section class="file-content" aria-label="선택한 파일"><div class="file-content-head"><span id="file-title">파일을 선택하세요</span><a id="github-file-link" href="${repoUrl(project)}" target="_blank" rel="noopener noreferrer">GitHub에서 열기 ↗</a></div><div id="file-body" class="file-body"><div class="file-placeholder"><span aria-hidden="true">⌘</span><p>왼쪽 목록에서 파일을 선택하면<br>이곳에 내용이 열립니다.</p></div></div></section></div>`;
  document.querySelector('#file-search').addEventListener('input', event => { fileQuery = event.target.value; renderFileList(project); });
  loadTree(project);
}

async function loadTree(project) {
  const list = document.querySelector('#file-list');
  if (!list) return;
  if (treeCache.has(project.id)) {
    renderFileList(project);
    if (!selectedFile) chooseInitialFile(project);
    return;
  }
  try {
    const url = `https://api.github.com/repos/GeonhoGit/${encodeURIComponent(project.repo)}/git/trees/${encodeURIComponent(project.branch)}?recursive=1`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`GitHub 응답 ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.tree)) throw new Error('파일 목록 형식이 올바르지 않습니다.');
    treeCache.set(project.id, data.tree.filter(item => item.type === 'blob').sort((a, b) => a.path.localeCompare(b.path, 'ko')));
    if (activeProject?.id !== project.id || activeTab !== 'files') return;
    renderFileList(project);
    if (!selectedFile) chooseInitialFile(project);
  } catch (error) {
    if (activeProject?.id !== project.id || activeTab !== 'files') return;
    list.innerHTML = `<div class="file-status error"><p>파일 목록을 가져오지 못했습니다.</p><small>${html(error.message)}</small><a href="${repoUrl(project)}" target="_blank" rel="noopener noreferrer">GitHub에서 보기 ↗</a><button id="retry-files" type="button">다시 시도</button></div>`;
    document.querySelector('#retry-files').addEventListener('click', () => loadTree(project));
  }
}

function renderFileList(project) {
  const list = document.querySelector('#file-list');
  const count = document.querySelector('#file-count');
  const files = treeCache.get(project.id);
  if (!list || !files) return;
  const visible = files.filter(file => file.path.toLocaleLowerCase().includes(fileQuery.trim().toLocaleLowerCase()));
  count.textContent = `${files.length}`;
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('div');
    empty.className = 'file-status';
    empty.textContent = '일치하는 파일이 없습니다.';
    list.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  visible.forEach(file => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `file-item ${selectedFile === file.path ? 'active' : ''}`;
    button.title = file.path;
    const prefix = document.createElement('span');
    prefix.className = 'file-item-icon';
    prefix.textContent = file.path.endsWith('.md') ? '▤' : '◇';
    const label = document.createElement('span');
    label.textContent = file.path;
    button.append(prefix, label);
    button.addEventListener('click', () => selectFile(project, file));
    fragment.append(button);
  });
  list.append(fragment);
}

function chooseInitialFile(project) {
  const files = treeCache.get(project.id) || [];
  const first = initialFile(files);
  if (first) selectFile(project, first);
}

async function selectFile(project, file) {
  selectedFile = file.path;
  renderFileList(project);
  const title = document.querySelector('#file-title');
  const link = document.querySelector('#github-file-link');
  const body = document.querySelector('#file-body');
  if (!title || !link || !body) return;
  title.textContent = file.path;
  link.href = githubFileUrl(project, file.path);
  body.replaceChildren();
  const extension = file.path.split('.').pop().toLocaleLowerCase();
  if (imageExtensions.has(extension)) {
    const image = document.createElement('img');
    image.className = 'source-image';
    image.src = rawFileUrl(project, file.path);
    image.alt = file.path;
    body.append(image);
    return;
  }
  if (!textExtensions.has(extension) || (file.size ?? 0) > 1_000_000) {
    const message = document.createElement('div');
    message.className = 'file-placeholder';
    message.innerHTML = '<span aria-hidden="true">↗</span><p>이 파일은 홈페이지에서 미리 볼 수 없습니다.<br>GitHub에서 원본을 열어주세요.</p>';
    body.append(message);
    return;
  }
  body.textContent = '파일을 여는 중…';
  try {
    const response = await fetch(rawFileUrl(project, file.path));
    if (!response.ok) throw new Error(`파일 응답 ${response.status}`);
    const content = await response.text();
    if (activeProject?.id !== project.id || activeTab !== 'files' || selectedFile !== file.path) return;
    const pre = document.createElement('pre');
    pre.className = `source-code${extension === 'md' ? ' markdown' : ''}`;
    const code = document.createElement('code');
    code.textContent = content;
    pre.append(code);
    body.replaceChildren(pre);
  } catch (error) {
    if (activeProject?.id !== project.id || selectedFile !== file.path) return;
    body.innerHTML = `<div class="file-placeholder"><span aria-hidden="true">!</span><p>파일을 열지 못했습니다.<br>${html(error.message)}</p></div>`;
  }
}

function route() {
  const project = parseProjectRoute();
  if (project) renderDetail(project);
  else renderHome();
  if (location.hash === '#works') document.querySelector('#works')?.scrollIntoView({ behavior: 'instant' });
  else window.scrollTo({ top: 0, behavior: 'instant' });
}

window.addEventListener('hashchange', route);
route();
