import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildManifest } from './manifest.ts';
import { ProjectDirectory } from './project-directory.ts';

const projectDir = ProjectDirectory.fromCwd();
const manifest = buildManifest(projectDir);

await fs.writeFile(
  projectDir.getOutputManifestPath(),
  JSON.stringify(manifest, null, 2),
);

const copied = new Set<string>();

for (const template of Object.values(manifest.templates)) {
  for (const css of template.css) {
    if (copied.has(css)) {
      continue;
    }

    copied.add(css);

    const clientPath = projectDir.getClientAssetPath(css);

    if (!existsSync(clientPath)) {
      const serverPath = projectDir.getServerBuildPath(css);

      if (!existsSync(serverPath)) {
        throw new Error(`Asset not found: ${serverPath}`);
      }

      await fs.copyFile(serverPath, clientPath);
    }
  }
}

await fs.mkdir(projectDir.getOutputStaticDir(), { recursive: true });

for (const asset of projectDir.getAllBuiltClientAssets()) {
  const outputPath = path.join(
    projectDir.getOutputStaticDir(),
    path.basename(asset),
  );
  await fs.rename(asset, outputPath);
}
