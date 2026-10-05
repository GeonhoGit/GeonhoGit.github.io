import test from 'node:test';
import assert from 'node:assert/strict';
import { projects } from '../src/catalog.js';
import { defaultTab, filterProjects, initialFile, rawFileUrl } from '../src/model.js';

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
