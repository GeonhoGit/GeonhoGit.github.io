export function defaultTab(project) {
  return project.preview ? 'preview' : 'files';
}

export function filterProjects(projects, query, category) {
  const needle = query.trim().toLocaleLowerCase();
  return projects.filter(project => {
    if (category !== 'all' && project.category !== category) return false;
    if (!needle) return true;
    const searchable = [project.title, project.repo, project.eyebrow, project.description, ...project.tags].join(' ').toLocaleLowerCase();
    return searchable.includes(needle);
  });
}

export function initialFile(files) {
  return files.find(file => file.path.toLocaleLowerCase() === 'readme.md')
    || files.find(file => file.path.toLocaleLowerCase() === 'index.html')
    || files.find(file => /(^|\/)README\.md$/i.test(file.path))
    || files.find(file => /(^|\/)index\.html$/i.test(file.path))
    || files[0];
}

function encodedPath(path) {
  if (!path || path.includes('\\')) throw new Error('Invalid file path');
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) throw new Error('Invalid file path');
  return parts.map(encodeURIComponent).join('/');
}

export function projectFiles(project, tree) {
  const prefix = project.sourcePath ? `${project.sourcePath}/` : '';
  return tree.filter(item => item.type === 'blob' && item.path.startsWith(prefix))
    .sort((a, b) => a.path.localeCompare(b.path, 'ko'));
}

export function githubProjectUrl(project) {
  const base = `https://github.com/GeonhoGit/${encodeURIComponent(project.repo)}`;
  return project.sourcePath ? `${base}/tree/${encodeURIComponent(project.branch)}/${encodedPath(project.sourcePath)}` : base;
}

export function rawFileUrl(project, path) {
  return `https://raw.githubusercontent.com/GeonhoGit/${encodeURIComponent(project.repo)}/${encodeURIComponent(project.branch)}/${encodedPath(path)}`;
}

export function githubFileUrl(project, path) {
  return `https://github.com/GeonhoGit/${encodeURIComponent(project.repo)}/blob/${encodeURIComponent(project.branch)}/${encodedPath(path)}`;
}
