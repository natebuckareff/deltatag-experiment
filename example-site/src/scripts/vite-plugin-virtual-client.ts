import type { Plugin, ViteDevServer } from 'vite';
import type { IslandEntry } from '../lib/island';
import { generateClientEntry } from './client-entry.ts';

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

      return generateClientEntry({
        islands,
        additionalImports: modules,
        resolveImportPath: file => `/${file}`,
      });
    },
  };
}
