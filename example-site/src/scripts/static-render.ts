import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { glob } from 'glob';
import { findProjectRoot } from './lib.ts';

const projectRoot = findProjectRoot();
const entryFiles = glob.sync(path.join(projectRoot, '.build/ssr/entry-*.js'));

for (const entryFile of entryFiles) {
  const url = pathToFileURL(entryFile).href;
  await import(url);
  console.log(`✓ Rendered ${entryFile}`);
}
