import { pathToFileURL } from 'node:url';
import { ProjectDirectory } from './project-directory.ts';

const projectDir = ProjectDirectory.fromCwd();
const entryFiles = projectDir.getAllBuiltServerEntries();

for (const entryFile of entryFiles) {
  const url = pathToFileURL(entryFile).href;
  await import(url);
  console.log(`✓ rendered ${entryFile}`);
}
