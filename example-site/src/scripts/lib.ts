import fs from 'node:fs';
import path from 'node:path';
import type { NodeRoute, Route } from './routes';

export function findProjectRoot() {
  let current = process.cwd();
  while (true) {
    const packageJson = path.join(current, 'package.json');
    if (fs.existsSync(packageJson)) {
      return current;
    }
    if (current === '/') {
      throw new Error('project root not found');
    }
    current = path.resolve(current, '..');
  }
}

export function readConfigRoutes(): NodeRoute {
  const root = findProjectRoot();
  const routesPath = path.join(root, 'routes.json');
  return JSON.parse(fs.readFileSync(routesPath, 'utf-8'));
}

export function getRouteKebab(ancestors: NodeRoute[], route: Route): string {
  return [...ancestors.map(a => a.path), route.path]
    .map(p => p.slice(1))
    .filter(Boolean)
    .join('-');
}

export function getRouteEntryName(
  ancestors: NodeRoute[],
  route: Route,
): string {
  const routeKebab = getRouteKebab(ancestors, route);
  return `entry-${routeKebab || 'index'}`;
}

export function getRouteTemplateName(
  ancestors: NodeRoute[],
  route: Route,
): string {
  const routeKebab = getRouteKebab(ancestors, route);
  return routeKebab || 'index';
}
