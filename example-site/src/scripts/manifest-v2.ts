import path from 'path';
import { exhaustive } from '../util';
import {
  isRouteConfigPage,
  RouteConfig,
  RouteConfigNode,
  RouteConfigPage,
} from './routes-v2';

export interface Manifest {
  routes: ManifestRouteNode;
  partials: Record<string, ManifestPartial>;
}

export type ManifestRoute =
  | ManifestRouteNode
  | ManifestRoutePage
  | ManifestRouteIntercept;

export interface ManifestRouteNode {
  kind: 'node';
  segment: string;
  index?: ManifestRouteIndex;
  fallback?: Record<string, ManifestRouteFallback>;
  slots?: Record<string, ManifestRoute>;
  children?: Record<string, ManifestRoute>;
}

export interface ManifestRouteIndex {
  layouts: string[];
  partial: string;
}

export interface ManifestRouteFallback {
  layouts: string[];
  partial: string;
}

export interface ManifestRoutePage {
  kind: 'page';
  segment: string;
  param?: string;
  layouts: string[];
  partial: string;
}

export interface ManifestRouteIntercept {
  kind: 'intercept';
  base: string[];
  children: Record<string, ManifestRoute>;
}

export interface ManifestPartial {
  css: string[];
  jsEntry?: string;
  jsImports: string[];
}

export function getManifestRoutes(config: RouteConfig): {
  routes: ManifestRoute;
  files: Map<string, string>;
} {
  const state = RouteState.empty();
  const routes = getManifestRoutesFromConfig(config, state);
  return { routes, files: state.files };
}

class RouteState {
  constructor(
    public files: Map<string, string>,
    public segments: string[],
    public layouts: string[],
  ) {}

  static empty(): RouteState {
    return new RouteState(new Map(), [], []);
  }

  static fromSegment(prev: RouteState, segment: string): RouteState {
    if (segment === '/') {
      return prev;
    } else {
      return new RouteState(
        prev.files,
        [...prev.segments, segment],
        [...prev.layouts],
      );
    }
  }

  associateFiles(manifestFile: string, configFile: string): void {
    this.files.set(manifestFile, configFile);
  }

  pushLayout(filename: string): string | undefined {
    const dot = filename.indexOf('.');
    const trimmed = dot === -1 ? filename : filename.slice(0, dot);
    const layout = [...this.segments, `${trimmed}.html`].join('/');
    if (!this.layouts.includes(layout)) {
      this.layouts.push(layout);
      return layout;
    }
  }

  getPartialPath(segment: string): string {
    return [...this.segments, `${segment}.html`].join('/');
  }

  getLayoutPaths(): string[] {
    return this.layouts;
  }
}

function getManifestRoutesFromConfig(
  config: RouteConfig,
  state: RouteState,
): ManifestRoute {
  const intercept = getManifestRouteIntercept(config, state);
  if (intercept) {
    return intercept;
  }

  return isRouteConfigPage(config)
    ? getManifestRoutesFromPage(config, state)
    : getManifestRoutesFromNode(config, state);
}

function getManifestRoutesFromPage(
  config: RouteConfigPage,
  state: RouteState,
): ManifestRoute {
  const segment = getSegmentFromPath(config.path);
  const layouts = state.getLayoutPaths();
  const partial = state.getPartialPath(segment);

  state.associateFiles(partial, config.file);

  return {
    kind: 'page',
    segment,
    param: config.param,
    layouts,
    partial,
  } satisfies ManifestRoutePage;
}

function getManifestRoutesFromNode(
  config: RouteConfigNode,
  state: RouteState,
): ManifestRoute {
  const segment = getSegmentFromPath(config.path);
  const nextState = RouteState.fromSegment(state, segment);

  if (config.layout) {
    const layout = nextState.pushLayout(path.basename(config.layout));
    if (layout) {
      nextState.associateFiles(layout, config.layout);
    }
  }

  let index: ManifestRouteIndex | undefined;
  let fallback: Record<string, ManifestRouteFallback> | undefined;
  let slots: Record<string, ManifestRoute> | undefined;
  let children: Record<string, ManifestRoute> | undefined;

  for (const child of config.children) {
    if (child.path === '/') {
      if (index) {
        throw Error('multiple index routes');
      }
      if (!isRouteConfigPage(child)) {
        throw Error('index route must be a page');
      }
      index = {
        layouts: nextState.getLayoutPaths(),
        partial: nextState.getPartialPath('%'),
      };
      continue;
    }

    const segment = getSegmentFromPath(child.path);
    const route = getManifestRoutesFromConfig(child, nextState);

    if (segment.startsWith('^')) {
      if (!isRouteConfigPage(child)) {
        throw Error('fallback route must be a page');
      }

      const fallbackRoute: ManifestRouteFallback = {
        layouts: nextState.getLayoutPaths(),
        partial: nextState.getPartialPath(segment),
      };

      fallback ??= {};
      if (fallback[segment]) {
        throw Error('cannot merge fallback routes');
      }
      fallback[segment] = fallbackRoute;
    } else if (segment.startsWith('@')) {
      slots ??= {};
      const old = slots[segment];
      slots[segment] = old ? mergeManifestRoutes(old, route) : route;
    } else {
      children ??= {};
      const old = children[segment];
      children[segment] = old ? mergeManifestRoutes(old, route) : route;
    }
  }

  return {
    kind: 'node',
    segment,
    index,
    fallback,
    slots,
    children,
  } satisfies ManifestRouteNode;
}

function getManifestRouteIntercept(
  config: RouteConfig,
  state: RouteState,
): ManifestRouteIntercept | undefined {
  if (config.intercept) {
    const segment = getSegmentFromPath(config.path);
    const routePath = state.segments.filter(s => !s.startsWith('@'));
    const { intercept, ...trimmed } = config;

    let base: string[];
    if (intercept === '.') {
      base = routePath;
    } else if (intercept === '..') {
      base = routePath.slice(0, -1);
    } else if (intercept === '../..') {
      base = routePath.slice(0, -2);
    } else if (intercept === '...') {
      base = [];
    } else {
      exhaustive(intercept);
    }

    return {
      kind: 'intercept',
      base,
      children: {
        [segment]: getManifestRoutesFromConfig(trimmed, state),
      },
    } satisfies ManifestRouteIntercept;
  }
}

function mergeManifestRoutes(
  left: ManifestRoute,
  right: ManifestRoute,
): ManifestRoute {
  if (left.kind === 'page' || right.kind === 'page') {
    throw Error('cannot merge page routes');
  }

  if (left.kind === 'intercept' || right.kind === 'intercept') {
    throw Error('cannot merge intercepts');
  }

  if (left.segment !== right.segment) {
    throw Error('route segment mismatch');
  }

  if (left.index && right.index) {
    throw Error('cannot merge index routes');
  }

  const merged: ManifestRouteNode = {
    kind: 'node',
    segment: left.segment,
    index: left.index ?? right.index,
    fallback: left.fallback,
    slots: left.slots,
    children: left.children,
  };

  if (right.fallback) {
    for (const [segment, fallback] of Object.entries(right.fallback)) {
      merged.fallback ??= {};
      if (merged.fallback[segment]) {
        throw Error('cannot merge fallback routes');
      }
      merged.fallback[segment] = fallback;
    }
  }

  if (right.slots) {
    for (const [segment, slot] of Object.entries(right.slots)) {
      merged.slots ??= {};
      if (merged.slots[segment]) {
        throw Error('cannot merge slot routes');
      }
      merged.slots[segment] = slot;
    }
  }

  if (right.children) {
    for (const [segment, rightChild] of Object.entries(right.children)) {
      merged.children ??= {};
      const leftChild = merged.children[segment];
      if (leftChild) {
        merged.children[segment] = mergeManifestRoutes(leftChild, rightChild);
      }
      merged.children[segment] = rightChild;
    }
  }

  return merged;
}

function getSegmentFromPath(path: string): string {
  if (path === '/') {
    return '/';
  }

  if (path.startsWith('/:')) {
    if (path.endsWith('?')) {
      return '?';
    } else {
      return '*';
    }
  } else if (path.startsWith('/*')) {
    return '**';
  } else {
    return path.slice(1);
  }
}
