import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { projects } from '../src/catalog.js';
import { defaultTab, filterProjects, initialFile, rawFileUrl } from '../src/model.js';

function assertPreviewFolder(repo, letter) {
  const project = projects.find(item => item.repo === repo);
  const preview = `play/프로젝트 ${letter}/index.html`;
  assert.equal(project.preview, preview);
  assert.ok(existsSync(new URL(`../${preview}`, import.meta.url)), `${preview} must exist`);
}

test('프로젝트 A는 차곡냥 실행 파일을 연다', () => {
  assertPreviewFolder('chagoknyang', 'A');
});

test('프로젝트 B는 저주받은 유물 사냥꾼 실행 파일을 연다', () => {
  assertPreviewFolder('cursed-relic-hunter-3d', 'B');
});

test('프로젝트 C는 던전 오토 레기온 실행 파일을 연다', () => {
  assertPreviewFolder('Dungeon-Auto-Legion', 'C');
});

test('프로젝트 D는 고누 실행 파일을 연다', () => {
  assertPreviewFolder('Gonu', 'D');
});

test('프로젝트 E는 K-직장인 퇴사 시뮬레이터 실행 파일을 연다', () => {
  assertPreviewFolder('k--', 'E');
});

test('프로젝트 F는 작은 웹 실험들 실행 파일을 연다', () => {
  assertPreviewFolder('P.F', 'F');
});

test('프로젝트 G는 지워지지 않은 밤 실행 파일을 연다', () => {
  assertPreviewFolder('unforgotten-night', 'G');
});

test('catalog includes the fourteen requested repositories and excludes home', () => {
  const expected = [
    'CalculatorSample', 'chagoknyang', 'cursed-relic-hunter-3d',
    'dokkaebi-market', 'Dungeon-Auto-Legion', 'Gonu', 'haesol-metro',
    'k--', 'moneybook', 'moru-keugi', 'P.F', 'siwangjeon',
    'unforgotten-night', 'Web_Game',
  ];
  assert.deepEqual(projects.map(project => project.repo).sort(), expected.sort());
  assert.ok(projects.every(project => project.repo !== 'home'));
});

test('playable work opens on preview and native work opens on files', () => {
  assert.equal(defaultTab(projects.find(project => project.repo === 'Gonu')), 'preview');
  assert.equal(defaultTab(projects.find(project => project.repo === 'P.F')), 'preview');
  assert.equal(defaultTab(projects.find(project => project.repo === 'moneybook')), 'files');
});

test('search finds Korean titles and category filter narrows results', () => {
  assert.deepEqual(filterProjects(projects, '도깨비', 'all').map(project => project.repo), ['dokkaebi-market']);
  assert.ok(filterProjects(projects, '', 'mobile').every(project => project.category === 'mobile'));
});

test('raw file URLs encode path segments and use the repository branch', () => {
  const project = projects.find(project => project.repo === 'k--');
  assert.equal(rawFileUrl(project, '한글 폴더/index.html'), 'https://raw.githubusercontent.com/GeonhoGit/k--/main1/%ED%95%9C%EA%B8%80%20%ED%8F%B4%EB%8D%94/index.html');
  assert.throws(() => rawFileUrl(project, '../secret'), /Invalid file path/);
});

test('file viewer starts with the project README rather than a nested dependency README', () => {
  const files = [
    { path: 'apps/mobile/ios/Runner/README.md' },
    { path: 'README.md' },
    { path: 'index.html' },
  ];
  assert.equal(initialFile(files).path, 'README.md');
});
