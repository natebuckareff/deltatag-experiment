import type { ViteManifest, ViteManifestChunk } from './project-directory.ts';
import { getTemplateName, ProjectDirectory } from './project-directory.ts';
import type { NodeRoute, Route } from './routes.ts';
import { isNodeRoute } from './routes.ts';

export interface Manifest {
  routes: ManifestNodeRoute;
  templates: Record<string, ManifestTemplate>;
}

export type ManifestRoute = ManifestNodeRoute | ManifestLeafRoute;

export interface ManifestNodeRoute {
  path: `/${string}`;
  template: string;
  children: ManifestRoute[];
}

export interface ManifestLeafRoute {
  path: `/${string}`;
  template: string;
}

export interface ManifestTemplate {
  css: string[];
  jsEntry?: string;
  jsImports: string[];
  layout?: ManifestLayout;
}

export interface ManifestLayout {
  // TODO
}

export function findMatchingRoute(
  route: ManifestNodeRoute,
  pathname: string,
): [ManifestNodeRoute[], ManifestRoute | undefined] {
  const paths = pathname.split('/').filter(Boolean);

  let current: ManifestNodeRoute = route;
  const ancestors: ManifestNodeRoute[] = [];

  while (true) {
    const path = paths.shift();

    if (!path) {
      return [ancestors, current];
    }

    const child = current.children.find(c => c.path.slice(1) === path);

    if (!child) {
      return [ancestors, undefined];
    }

    if (!('children' in child)) {
      if (paths.length > 0) {
        return [ancestors, undefined];
      } else {
        ancestors.push(current);
        return [ancestors, child];
      }
    }

    ancestors.push(current);
    current = child;
  }
}

export function buildManifest(projectDir: ProjectDirectory): Manifest {
  const projectRoutes = projectDir.readRoutes();
  const { routes, templates } = buildRoutes(projectRoutes);
  return {
    routes,
    templates: buildTemplates(projectDir, templates),
  };
}

function buildRoutes(route: NodeRoute): {
  routes: ManifestNodeRoute;
  templates: string[];
} {
  const templates: string[] = [];

  const buildNode = (
    ancestors: NodeRoute[],
    route: NodeRoute,
  ): ManifestNodeRoute => {
    const nextAncestors = [...ancestors, route];
    const routePath = { ancestors, route };
    const template = getTemplateName(routePath);
    templates.push(template);
    return {
      path: route.path,
      template: `${template}.html`,
      children: route.children.map(child => build(nextAncestors, child)),
    };
  };

  const build = (ancestors: NodeRoute[], route: Route): ManifestRoute => {
    if (isNodeRoute(route)) {
      return buildNode(ancestors, route);
    }
    const routePath = { ancestors, route };
    const template = getTemplateName(routePath);
    templates.push(template);
    return {
      path: route.path,
      template: `${template}.html`,
    };
  };

  return { routes: buildNode([], route), templates };
}

function buildTemplates(
  projectDir: ProjectDirectory,
  templates: string[],
): Record<string, ManifestTemplate> {
  const server = projectDir.readServerViteManifest();
  const client = projectDir.readClientViteManifest();

  const output: Record<string, ManifestTemplate> = {};

  for (const name of templates) {
    const viteKey = projectDir.getClientManifestKey(name);
    const chunk = client[viteKey];
    const chunks = chunk ? getChunks(client, viteKey) : [];

    const item: ManifestTemplate = {
      css: chunks.flatMap(chunk => chunk.css ?? []),
      jsEntry: chunk?.file,
      jsImports: chunks.slice(1).map(chunk => chunk.file),
    };

    const serverViteKey = projectDir.getServerManifestKey(name);
    const serverChunk = server[serverViteKey];
    if (serverChunk) {
      const serverChunks = getChunks(server, serverViteKey);
      const serverCss = serverChunks.flatMap(chunk => chunk.css ?? []);
      item.css.push(...serverCss);
    }

    item.css = uniq(item.css);
    item.jsImports = uniq(item.jsImports);

    output[`${name}.html`] = item;
  }

  return output;
}

function getChunks(manifest: ViteManifest, name: string): ViteManifestChunk[] {
  const seen = new Set<string>([name]);

  const getChunks = (chunk: ViteManifestChunk): ViteManifestChunk[] => {
    const chunks: ViteManifestChunk[] = [];

    if (chunk.imports) {
      for (const file of chunk.imports) {
        if (seen.has(file)) {
          continue;
        }
        seen.add(file);

        const importee = manifest[file];
        if (!importee) {
          throw new Error(`manifest key not found: ${file}`);
        }

        chunks.push(...getChunks(importee));
        chunks.push(importee);
      }
    }

    return chunks;
  };

  const chunk = manifest[name];

  if (!chunk) {
    throw new Error(`manifest key not found: ${name}`);
  }

  return [chunk, ...getChunks(chunk)];
}

function uniq<T>(array: T[]): T[] {
  const seen = new Set<T>();
  return array
    .map(value => {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
      return value;
    })
    .filter((x): x is NonNullable<typeof x> => x !== undefined);
}
