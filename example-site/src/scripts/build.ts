import fs from 'node:fs';
import path from 'node:path';
import { IslandEntry } from '../lib/island';
import { generateClientEntry } from './client-entry';
import { ProjectDirectory } from './project-directory';
import { RenderParams, renderToHtmlAndIslands } from './render';
import { RoutePath } from './routes';

export function renderPage(params: RenderParams) {
  const projectDir = ProjectDirectory.fromCwd();
  const { html, islands } = renderToHtmlAndIslands(params);
  const templatePath = projectDir.getTemplatePath(params.path);

  fs.mkdirSync(path.dirname(templatePath), { recursive: true });
  fs.writeFileSync(templatePath, html);

  console.log(`✓ rendered ${projectDir.relative(templatePath)}`);

  if (islands.length > 0) {
    const clientEntryPath = writeClientEntry(projectDir, params.path, islands);

    const relativeClientEntryPath = projectDir.relative(clientEntryPath);

    console.log(`  • generated ${relativeClientEntryPath}`);

    for (const { entry } of islands) {
      const { component, exportName } = entry;
      const name = exportName === 'default' ? component : exportName;
      console.log(`    ◦ ${name}`);
    }
  }
}

function writeClientEntry(
  projectDir: ProjectDirectory,
  routePath: RoutePath,
  islands: { file: string; entry: IslandEntry }[],
): string {
  const entryPath = projectDir.getClientEntryPath(routePath);
  const entryDir = path.dirname(entryPath);

  const code = generateClientEntry(islands, file => {
    const componentAbsPath = path.join(projectDir.projectRoot, file);
    const relativePath = path.relative(entryDir, componentAbsPath);
    return relativePath.replace(/\\/g, '/');
  });

  fs.mkdirSync(path.dirname(entryPath), { recursive: true });
  fs.writeFileSync(entryPath, code);

  return entryPath;
}
