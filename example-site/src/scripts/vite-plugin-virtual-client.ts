// TODO: rename vite-plugin-virtual-module

import type { Plugin, ViteDevServer } from 'vite';
import type { IslandEntry } from '../lib/island';
import { generateClientEntry } from './client-entry.ts';
import { getEntryName } from './project-directory.ts';
import type { RouteMatch } from './routes.ts';

interface VirtualClientEntriesPlugin extends Plugin {
  setRoute(
    match: RouteMatch,
    islands: IslandEntry[],
    modules: string[],
  ): string;

  invalidateRoute(match: RouteMatch): void;
}

const PUBLIC_PREFIX = '/$site/';
const INTERNAL_PREFIX = `\0${PUBLIC_PREFIX}`;

function getVirtualModuleId(match: RouteMatch): string {
  const entry = getEntryName(match);
  return `/$site/${entry}.tsx`;
}

export function virtualClientEntriesPlugin(): VirtualClientEntriesPlugin {
  let server: ViteDevServer | undefined;

  const islandsByRoute = new Map<string, IslandEntry[]>();
  const modulesByRoute = new Map<string, string[]>();

  return {
    name: 'virtual-client-entries',

    configureServer(s) {
      server = s;
    },

    setRoute(match, islands, modules): string {
      const id = getVirtualModuleId(match);
      islandsByRoute.set(id, islands);
      modulesByRoute.set(id, modules);
      return id;
    },

    invalidateRoute(match) {
      const id = getVirtualModuleId(match);
      islandsByRoute.delete(id);
      modulesByRoute.delete(id);

      const module = server?.moduleGraph.getModuleById(`\0${id}`);
      if (module) {
        server?.moduleGraph.invalidateModule(module);
      }
    },

    resolveId(id) {
      if (id.startsWith(PUBLIC_PREFIX)) {
        return `\0${id}`;
      }
    },

    load(internalId) {
      if (!internalId.startsWith(INTERNAL_PREFIX)) {
        return;
      }

      const id = internalId.slice(1); // remove the \0 prefix
      const islands = islandsByRoute.get(id) ?? [];
      const modules = modulesByRoute.get(id) ?? [];

      return generateClientEntry({
        islands,
        additionalImports: modules,
        resolveImportPath: file => `/${file}`,
      });
    },
  };
}
