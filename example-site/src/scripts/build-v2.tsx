import fs from 'node:fs';
import path from 'node:path';
import { JSX } from 'solid-js';
import { NoHydration, renderToString } from 'solid-js/web';
import {
  IslandEntry,
  readIslandRegistry,
  resetIslandRegistry,
} from '../lib/island';
import {
  findProjectRoot,
  getRouteEntryName,
  getRouteTemplateName,
} from './lib';
import { NodeRoute, Route } from './routes';

interface RenderParams {
  ancestors: NodeRoute[];
  route: Route;
  layouts: PageModule[];
  page: PageModule;
}

interface PageModule {
  Component: (props?: { children?: JSX.Element }) => JSX.Element;
  file: string;
}

export function renderPage(params: RenderParams) {
  resetIslandRegistry();

  const projectRoot = findProjectRoot();
  const outDir = path.join(projectRoot, '.output');
  const route = params.route;

  const Component = getComposedComponents(params.layouts, params.page);
  const html = renderDocument(Component);
  const templateName = getRouteTemplateName(params.ancestors, route);
  const outFile = templateName + '.html';
  const outPath = path.join(outDir, 'templates', outFile);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);
  console.log(`✓ rendered ${path.relative(projectRoot, outPath)}`);

  const islandRegistry = [...readIslandRegistry()];

  if (islandRegistry.length > 0) {
    const clientEntryPath = generateClientEntry(
      params.ancestors,
      route,
      projectRoot,
      islandRegistry,
    );

    const relativeClientEntryPath = path.relative(projectRoot, clientEntryPath);

    console.log(`  • generated ${relativeClientEntryPath}`);

    for (const [, meta] of islandRegistry) {
      const { component, exportName } = meta;
      const name = exportName === 'default' ? component : exportName;
      console.log(`    ◦ ${name}`);
    }
  }
}

function getComposedComponents(
  layoutPages: PageModule[],
  indexPage: PageModule,
): () => JSX.Element {
  const components = [...layoutPages, indexPage];

  const Composed = (props?: { children?: JSX.Element }) => {
    return components.reduceRight<JSX.Element>(
      (child, { Component }) => <Component>{child}</Component>,
      props?.children,
    );
  };

  return () => (
    <NoHydration>
      <Composed />
    </NoHydration>
  );
}

function renderDocument(Component: () => JSX.Element) {
  return `<!doctype html>${renderToString(Component)}`;
}

function generateClientEntry(
  ancestors: NodeRoute[],
  route: Route,
  projectRoot: string,
  islandRegistry: [string, IslandEntry][],
): string {
  const imports: string[] = [];
  const hydrations: string[] = [];

  imports.push(`/* @refresh reload */`);
  imports.push(`import { hydrate } from 'solid-js/web';`);
  imports.push(`import 'solid-devtools';`);

  const entryName = getRouteEntryName(ancestors, route);
  const clientEntryDir = path.join(projectRoot, '.build/client');
  const clientEntryPath = path.join(clientEntryDir, `${entryName}.tsx`);

  for (const [file, meta] of islandRegistry) {
    const componentAbsPath = path.join(projectRoot, file);
    const relativePath = path.relative(clientEntryDir, componentAbsPath);
    const importPath = relativePath.replace(/\\/g, '/');
    const importFrom = JSON.stringify(importPath);
    const alias = `Island${imports.length}`;

    const importCode =
      meta.exportName === 'default'
        ? `import ${alias} from ${importFrom};`
        : `import { ${meta.exportName} as ${alias} } from ${importFrom};`;

    const id = JSON.stringify(meta.id);
    const hydrationCode = `hydrate(() => <${alias} />, document.getElementById(${id}));`;

    imports.push(importCode);
    hydrations.push(hydrationCode);
  }

  const code = `${imports.join('\n')}\n\n${hydrations.join('\n')}`;

  fs.mkdirSync(clientEntryDir, { recursive: true });
  fs.writeFileSync(clientEntryPath, code);

  return clientEntryPath;
}
