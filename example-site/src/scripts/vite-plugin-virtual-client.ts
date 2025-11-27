import type { Plugin, ViteDevServer } from 'vite';
import type { IslandEntry } from '../lib/island';

interface VirtualClientEntriesPlugin extends Plugin {
  setRoute(route: string, islands: IslandEntry[], modules: string[]): void;
  invalidateRoute(route: string): void;
}

const VIRTUAL_PREFIX = 'virtual:client-entry';
const RESOLVED_PREFIX = '\0virtual:client-entry:'; // note the colon is arbitrary, just a separator

export function virtualClientEntriesPlugin(): VirtualClientEntriesPlugin {
  let server: ViteDevServer | undefined;

  const islandsByRoute = new Map<string, IslandEntry[]>();
  const modulesByRoute = new Map<string, string[]>();

  return {
    name: 'virtual-client-entries',

    configureServer(s) {
      server = s;
    },

    setRoute(route, islands, modules) {
      islandsByRoute.set(route, islands);
      modulesByRoute.set(route, modules);
    },

    invalidateRoute(route) {
      islandsByRoute.delete(route);
      modulesByRoute.delete(route);

      const id = RESOLVED_PREFIX + (route || '/').replace(/\//g, '_') + '.tsx';
      const mod = server?.moduleGraph.getModuleById(id);
      if (mod) {
        server?.moduleGraph.invalidateModule(mod);
      }
    },

    resolveId(id) {
      const normalized = id.startsWith('/') ? id.slice(1) : id;

      if (normalized.startsWith(VIRTUAL_PREFIX)) {
        // normalized: "virtual:client-entry" or "virtual:client-entry/login"
        const route = normalized.slice(VIRTUAL_PREFIX.length); // "" or "/login"
        // Important: give it a .tsx extension so vite-plugin-solid runs
        const virtualTsxId =
          RESOLVED_PREFIX + (route || '/').replace(/\//g, '_') + '.tsx';
        return virtualTsxId;
      }
    },

    load(id) {
      if (!id.startsWith(RESOLVED_PREFIX)) return;

      // Strip prefix + ".tsx"
      const rest = id.slice(RESOLVED_PREFIX.length); // e.g. "_ .tsx" or "_login.tsx"
      const routeKey = rest.replace(/\.tsx$/, '').replace(/^_/, '');
      const route = routeKey === '' ? '/' : '/' + routeKey;

      const islands = islandsByRoute.get(route);
      const modules = modulesByRoute.get(route) ?? [];

      console.log('load', id, route);

      if (!islands || islands.length === 0) {
        return `// No islands for route: ${route}`;
      }

      return generateClientEntryCode(islands, modules);
    },
  };
}

function generateClientEntryCode(
  islandRegistry: IslandEntry[],
  modules: string[],
): string {
  const imports: string[] = [];
  const hydrations: string[] = [];

  // 1) Import route modules for CSS side effects
  for (const file of modules) {
    const importPath = `/${file}`; // same normalization as islands
    const importFrom = JSON.stringify(importPath);
    imports.push(`import ${importFrom};`);
  }

  for (const island of islandRegistry) {
    const importPath = `/${island.file}`;
    const importFrom = JSON.stringify(importPath);
    const alias = `Island${imports.length}`;

    const importCode =
      island.exportName === 'default'
        ? `import ${alias} from ${importFrom};`
        : `import { ${island.exportName} as ${alias} } from ${importFrom};`;

    imports.push(importCode);

    const id = JSON.stringify(island.id);

    const hydrationCode =
      `hydrate(` +
      `() => createComponent(${alias}, {}), ` +
      `document.getElementById(${id}), ` +
      `{ renderId: ${id} }` +
      `);`;

    hydrations.push(hydrationCode);
  }

  return [
    `/* @refresh reload */`,
    `import { hydrate } from 'solid-js/web';`,
    `import { createComponent } from 'solid-js';`,
    `import 'solid-devtools';`,
    imports.join('\n'),
    '',
    hydrations.join('\n'),
  ].join('\n');
}
