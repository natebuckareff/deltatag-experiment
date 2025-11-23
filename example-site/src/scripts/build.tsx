import fs from 'node:fs';
import path from 'node:path';
import type { JSX } from 'solid-js';
import { NoHydration, renderToString } from 'solid-js/web';
import type { IslandEntry } from '../lib/island';
import { readIslandRegistry, resetIslandRegistry } from '../lib/island';

interface PageSource {
  file: string;
  module: PageModule;
}

interface PageModule {
  default: (props: { children?: JSX.Element }) => JSX.Element;
  page: PageConfig;
}

export interface PageConfig {
  path: string;
  layout?: boolean;
}

export interface BuildOptions {
  pages: PageSource[];
  projectRoot: string;
  outDir: string;
}

interface RawRoute {
  path?: string;
  layout?: string;
  index?: string;
  entry?: string;
  children?: RawRoute[];
}

export function build({ pages, projectRoot, outDir }: BuildOptions) {
  const routes = createRoutes(pages);
  const pagesByFile: Record<string, PageSource> = {};

  for (const page of pages) {
    pagesByFile[page.file] = page;
  }

  const walk = (ancestors: RawRoute[], route: RawRoute) => {
    if (route.path === undefined) {
      throw Error('route path is undefined');
    }

    const index = route.index;
    if (!index) {
      throw Error('route index not found');
    }

    const layoutPages: PageSource[] = [];
    for (const ancestor of ancestors) {
      if (ancestor.layout) {
        layoutPages.push(pagesByFile[ancestor.layout]);
      }
    }

    if (route.layout) {
      layoutPages.push(pagesByFile[route.layout]);
    }

    resetIslandRegistry();

    const indexPage = pagesByFile[index];
    const Component = getComposedComponents(layoutPages, indexPage);
    const html = renderDocument(Component);
    const outPath = getTemplateOutPath(outDir, ancestors, route);
    const pagename = path.basename(outPath, '.html');

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html);
    console.log(`✓ rendered ${path.relative(projectRoot, outPath)}`);

    const islandRegistry = [...readIslandRegistry()];

    if (islandRegistry.length > 0) {
      const clientEntryPath = generateClientEntry(
        projectRoot,
        pagename,
        islandRegistry,
      );

      const relativeClientEntryPath = path.relative(
        projectRoot,
        clientEntryPath,
      );

      route.entry = path.basename(clientEntryPath);

      console.log(`  • generated ${relativeClientEntryPath}`);

      for (const [, meta] of islandRegistry) {
        const { component, exportName } = meta;
        const name = exportName === 'default' ? component : exportName;
        console.log(`    ◦ ${name}`);
      }
    }

    if (route.children) {
      for (const child of route.children) {
        walk([...ancestors, route], child);
      }
    }
  };

  walk([], routes);

  const routesJson = JSON.stringify(routes, null, 2);
  fs.writeFileSync(path.join(outDir, 'routes.json'), routesJson);
}

function getTemplateOutPath(
  outDir: string,
  ancestors: RawRoute[],
  route: RawRoute,
): string {
  const fullPath = getRouteFullPath(ancestors, route);

  if (route.children && route.children.length > 1) {
    return path.join(outDir, 'templates', fullPath.join('/'), 'index.html');
  } else {
    return path.join(
      outDir,
      'templates',
      `${fullPath.join('/') || 'index'}.html`,
    );
  }
}

function getRouteFullPath(ancestors: RawRoute[], route: RawRoute): string[] {
  return [...ancestors.map(a => a.path), route.path]
    .map(p => p?.replace(/^\//, ''))
    .filter((s): s is string => Boolean(s));
}

function getComposedComponents(
  layoutPages: PageSource[],
  indexPage: PageSource,
): () => JSX.Element {
  const components = [
    ...layoutPages.map(p => p.module.default),
    indexPage.module.default,
  ];

  const Composed = (props?: { children?: JSX.Element }) => {
    return components.reduceRight<JSX.Element>(
      (child, Comp) => <Comp>{child}</Comp>,
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

function createRoutes(sources: PageSource[]): RawRoute {
  interface Entry {
    segments: string[];
    source: PageSource;
  }

  const entries: Entry[] = sources.map(source => ({
    segments: source.module.page.path.split('/').filter(s => s !== ''),
    source,
  }));

  const root: RawRoute = {
    path: '/',
    layout: undefined,
    index: undefined,
    entry: undefined,
    children: [],
  };

  for (const entry of entries) {
    const { page } = entry.source.module;
    const segments = page.path
      .split('/')
      .filter(Boolean)
      .map(s => `/${s}`);

    let node = root;
    while (true) {
      const key = segments.shift();
      if (!key) {
        break;
      }

      const child = node.children?.find(child => child.path === key);
      if (child) {
        node = child;
        continue;
      }

      const newChild: RawRoute = {
        path: key,
        layout: undefined,
        index: undefined,
        entry: undefined,
      };
      node.children ??= [];
      node.children.push(newChild);
      node = newChild;
    }

    if (page.layout) {
      node.layout = entry.source.file;
    } else {
      node.index = entry.source.file;
    }
  }

  return root;
}

function generateClientEntry(
  projectRoot: string,
  pagename: string,
  islandRegistry: [string, IslandEntry][],
) {
  const imports: string[] = [];
  const hydrations: string[] = [];

  const clientEntryDir = path.join(projectRoot, '.build/client');
  const clientEntryPath = path.join(clientEntryDir, `entry-${pagename}.tsx`);

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
