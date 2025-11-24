export type Route = NodeRoute | LeafRoute;

export interface NodeRoute {
  path: `/${string}`;
  layout?: string;
  index: string;
  entry?: string;
  children: Route[];
}

export interface LeafRoute {
  path: `/${string}`;
  index: string;
  entry?: string;
}

export function isNodeRoute(route: Route): route is NodeRoute {
  return 'children' in route;
}

export function isLeafRoute(route: Route): route is LeafRoute {
  return !isNodeRoute(route);
}

export function findMatchingRoute(
  route: NodeRoute,
  pathname: string,
): Route | undefined {
  const paths = pathname.split('/').filter(Boolean);

  let current: NodeRoute = route;

  while (true) {
    const path = paths.shift();

    if (!path) {
      return current;
    }

    const child = current.children.find(c => c.path.slice(1) === path);

    if (!child) {
      return;
    }

    if (isLeafRoute(child)) {
      if (paths.length > 0) {
        return;
      } else {
        return child;
      }
    }

    current = child;
  }
}
