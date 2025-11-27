import fs from 'node:fs';
import path from 'node:path';
import { generateClientEntry } from './client-entry';
import { ProjectDirectory } from './project-directory';
import { RenderParams, renderToHtmlAndIslands } from './render';

export function build(params: RenderParams) {
  const projectDir = ProjectDirectory.fromCwd();
  const { html, islands } = renderToHtmlAndIslands(params);
  const templatePath = projectDir.getTemplatePath(params.match);

  fs.mkdirSync(path.dirname(templatePath), { recursive: true });
  fs.writeFileSync(templatePath, html);

  console.log(`✓ rendered ${projectDir.relative(templatePath)}`);

  if (islands.length > 0) {
    const entryPath = projectDir.getClientEntryPath(params.match);
    const entryDir = path.dirname(entryPath);

    const code = generateClientEntry(islands, file => {
      const componentAbsPath = path.join(projectDir.projectRoot, file);
      const relativePath = path.relative(entryDir, componentAbsPath);
      return relativePath.replace(/\\/g, '/');
    });

    fs.mkdirSync(path.dirname(entryPath), { recursive: true });
    fs.writeFileSync(entryPath, code);

    console.log(`  • generated ${projectDir.relative(entryPath)}`);

    for (const island of islands) {
      const { component, exportName } = island;
      const name = exportName === 'default' ? component : exportName;
      console.log(`    ◦ ${name}`);
    }
  }
}
