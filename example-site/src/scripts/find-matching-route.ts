export interface AnyRoute {
  path: `/${string}`;
}

export type AnyNodeRoute<R extends AnyRoute> = R & { children: R[] };

export function findMatchingRouteGeneric<R extends AnyRoute>(
  root: AnyNodeRoute<R>,
  pathname: string,
): [AnyNodeRoute<R>[], R | undefined] {
  const paths = pathname.split('/').filter(Boolean);

  let current: AnyNodeRoute<R> = root;
  const ancestors: AnyNodeRoute<R>[] = [];

  while (true) {
    const segment = paths.shift();

    if (!segment) {
      return [ancestors, current];
    }

    const child = current.children.find(c => c.path.slice(1) === segment);

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
    current = child as AnyNodeRoute<R>;
  }
}
