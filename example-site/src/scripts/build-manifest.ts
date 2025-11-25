import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import { buildManifest } from './manifest.ts';
import { ProjectDirectory } from './project-directory.ts';

const projectDir = ProjectDirectory.fromCwd();
const manifest = buildManifest(projectDir);

async function copyServerAsset(filename: string): Promise<void> {
  const clientPath = projectDir.getClientAssetPath(filename);

  if (!existsSync(clientPath)) {
    const serverPath = projectDir.getServerAssetPath(filename);

    if (!existsSync(serverPath)) {
      throw new Error(`Asset not found: ${filename}`);
    }

    await fs.copyFile(serverPath, clientPath);
  }
}

for (const template of Object.values(manifest.templates)) {
  for (const css of template.css) {
    await copyServerAsset(css);
  }
}

await fs.writeFile(
  projectDir.getManifestPath(),
  JSON.stringify(manifest, null, 2),
);
