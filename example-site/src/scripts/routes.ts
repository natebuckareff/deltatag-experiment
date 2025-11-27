import { findMatchingRouteGeneric } from './find-matching-route.ts';

export type Route = NodeRoute | LeafRoute;

export interface NodeRoute {
  path: `/${string}`;
  layout?: string;
  index: string;
  children: Route[];
}

export interface LeafRoute {
  path: `/${string}`;
  index: string;
}

export interface RouteMatch {
  ancestors: NodeRoute[];
  route: Route;
}

export function getRouteMatchPath(match: RouteMatch): string[] {
  return [...match.ancestors.map(a => a.path), match.route.path]
    .map(p => p.slice(1))
    .filter(Boolean);
}

export function getRouteMatchUrl(match: RouteMatch): string {
  return `/${getRouteMatchPath(match).join('/')}`;
}

export function isNodeRoute(route: Route): route is NodeRoute {
  return 'children' in route;
}

export function* findRoutes(
  route: NodeRoute,
  predicate: (route: Route) => boolean,
): Generator<RouteMatch> {
  function* walk(acc: NodeRoute[], route: Route): Generator<RouteMatch> {
    if (predicate(route)) {
      yield { ancestors: acc, route };
    }
    if (isNodeRoute(route)) {
      for (const child of route.children) {
        yield* walk([...acc, route], child);
      }
    }
  }

  yield* walk([], route);
}

export function findMatchingRoute(
  route: NodeRoute,
  pathname: string,
): RouteMatch | undefined {
  return findMatchingRouteGeneric(route, pathname);
}
