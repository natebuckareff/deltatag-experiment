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

export interface RoutePath {
  ancestors: NodeRoute[];
  route: Route;
}

export function isNodeRoute(route: Route): route is NodeRoute {
  return 'children' in route;
}
