import { exhaustive, print } from '../util';
import { FileTree, readFileTree } from './file-tree';

export type RouteConfig =
  | RouteConfigNode
  // | RouteConfigSlot
  // | RouteConfigIntercept
  | RouteConfigPage;

interface RouteConfigNode {
  path?: string;
  param?: string;
  layout?: string;
  children: RouteConfig[];
}

// interface RouteConfigSlot {
//   slot: string;
//   layout?: string;
//   children: RouteConfig[];
// }

// interface RouteConfigIntercept {
//   base: 'current-level' | '1-level' | '2-levels' | 'root-level';
//   layout?: string;
//   children: RouteConfig[];
// }

interface RouteConfigPage {
  path: string;
  param?: string;
  file: string;
}

type ParsedRouteName =
  | ParsedSegmentName
  | { kind: 'group'; name: string; tree: FileTree }
  | { kind: 'slot'; name: string; tree: FileTree }
  | { kind: 'fallback'; name: string; tree: FileTree };

type RouteConfigParamType = 'required' | 'optional' | 'catch-all';

interface ParsedSegmentName {
  kind: 'segment';
  name: string;
  param?: RouteConfigParamType;
  tree: FileTree;
}

interface RouteConfigParam {
  type: RouteConfigParamType;
  name: string;
}

const REQUIRED_PARAM_REGEX = /^\[([^\.]+)\](\.[^\.]*)?$/;
const OPTIONAL_PARAM_REGEX = /^\[\[([^\.]+)\]\](\.[^\.]*)?$/;
const CATCH_ALL_REGEX = /^\[\.\.\.([^\.]+)\](\.[^\.]*)?$/;
const ESCAPED_REGEX = /^([^()]+)\(([^)]+)\)(\.[^\.]*)?$/;

export async function getRouteConfig(
  dirPath: string,
): Promise<RouteConfigNode> {
  const tree = await readFileTree(dirPath);
  return {
    path: '/',
    children: tree.children.map(child => getRouteConfigFromFileTree(child)),
  } satisfies RouteConfigNode;
}

function getRouteConfigFromFileTree(tree: FileTree): RouteConfig {
  const routeName = parseRouteName(tree);

  if (routeName.tree.kind === 'file') {
    const path = getRoutePath(routeName);
    if (!path) {
      // fails for groups and index aliases, which are handled when parsing
      // directories
      throw Error('invalid route path');
    }

    return {
      path,
      param: getParamName(routeName),
      file: tree.src,
    };
  } else if (routeName.tree.kind === 'dir') {
    // find the index route for segment dirs
    let indexTree: FileTree | undefined;
    if (routeName.kind === 'segment') {
      for (const child of routeName.tree.children) {
        if (isIndex(child)) {
          indexTree = child;
          break;
        }
      }
    }

    let layout: string | undefined;

    const children: RouteConfig[] = [];

    if (indexTree) {
      children.push({
        path: '/',
        file: indexTree.src,
      } satisfies RouteConfigPage);
    }

    // parse the children, skipping the index
    for (const child of routeName.tree.children) {
      if (indexTree?.filename === child.filename) {
        continue;
      }

      if (isLayout(child)) {
        layout = child.src;
        continue;
      }

      children.push(getRouteConfigFromFileTree(child));
    }

    if (routeName.kind === 'segment') {
      return {
        path: getRoutePath(routeName),
        param: getParamName(routeName),
        layout,
        children,
      } satisfies RouteConfigNode;
    } else if (routeName.kind === 'group') {
      return {
        layout,
        children,
      } satisfies RouteConfigNode;
    } else if (routeName.kind === 'slot') {
      return {
        path: getRoutePath(routeName),
        layout,
        children,
      } satisfies RouteConfigNode;
    } else if (routeName.kind === 'fallback') {
      throw Error('fallback routes must not be directories');
    } else {
      exhaustive(routeName);
    }
  } else {
    exhaustive(routeName.tree);
  }
}

function isIndex(child: FileTree): boolean {
  if (child.kind === 'dir') {
    return false;
  }

  if (isLayout(child)) {
    return false;
  }

  const childRouteName = parseRouteName(child);

  if (childRouteName.kind === 'segment') {
    if (childRouteName.name === 'index') {
      return true;
    }
  } else if (childRouteName.kind === 'group') {
    return false;
  }

  return false;
}

function isLayout(tree: FileTree): boolean {
  return (
    tree.kind === 'file' &&
    tree.filename.startsWith('_') &&
    !tree.filename.startsWith('__')
  );
}

function getParamName(routeName: ParsedRouteName): string | undefined {
  return routeName.kind === 'segment' && routeName.param
    ? routeName.name
    : undefined;
}

function getSegmentPath(routeName: ParsedSegmentName): string {
  const { name, param } = routeName;
  if (param) {
    if (param === 'required') {
      return `/:${name}`;
    } else if (param === 'optional') {
      return `/:${name}?`;
    } else if (param === 'catch-all') {
      return `/*${name}`;
    } else {
      exhaustive(param);
    }
  }
  return `/${name}`;
}

function getRoutePath(routeName: ParsedRouteName): string | undefined {
  if (routeName.kind === 'segment') {
    return getSegmentPath(routeName);
  } else if (routeName.kind === 'group') {
    return;
  } else if (routeName.kind === 'slot') {
    return `/@${routeName.name}`;
  } else if (routeName.kind === 'fallback') {
    return `/^${routeName.name}`;
  } else {
    exhaustive(routeName);
  }
}

function parseRouteName(tree: FileTree): ParsedRouteName {
  if (isLayout(tree)) {
    throw Error('unexpected layout');
  }

  const groupName = parseGroupName(tree.filename);
  if (groupName) {
    return {
      kind: 'group',
      name: groupName,
      tree,
    };
  }

  const slotName = parseSlotName(tree.filename);
  if (slotName) {
    return {
      kind: 'slot',
      name: slotName,
      tree,
    };
  }

  const fallbackName = parseFallbackName(tree.filename);
  if (fallbackName) {
    return {
      kind: 'fallback',
      name: fallbackName,
      tree,
    };
  }

  const param = parseParam(tree.filename);
  const escaped = parseEscapedRoute(tree.filename);

  const name = param
    ? param.name
    : (escaped?.segment ?? parseSegmentName(tree.filename));

  return {
    kind: 'segment',
    name,
    param: param?.type,
    tree,
  };
}

function parseSegmentName(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) {
    return filename;
  }
  return filename.slice(0, dot);
}

function parseEscapedRoute(
  filename: string,
): { segment: string; group: string } | undefined {
  const match = filename.match(ESCAPED_REGEX);
  if (match) {
    return {
      segment: match[1]!,
      group: match[2]!,
    };
  }
}

function parseGroupName(filename: string): string | undefined {
  if (filename.startsWith('(') && filename.endsWith(')')) {
    return filename.slice(1, -1);
  }
}

function parseSlotName(filename: string): string | undefined {
  if (filename.startsWith('@')) {
    return filename.slice(1);
  }
}

function parseFallbackName(filename: string): string | undefined {
  if (filename.startsWith('*')) {
    return filename.slice(1);
  }
}

function parseParam(filename: string): RouteConfigParam | undefined {
  return (
    parseOptionalParamName(filename) ??
    parseRequiredParamName(filename) ??
    parseCatchAllParamName(filename)
  );
}

function parseOptionalParamName(
  filename: string,
): RouteConfigParam | undefined {
  const match = filename.match(OPTIONAL_PARAM_REGEX);
  if (match) {
    return {
      type: 'optional',
      name: match[1]!,
    };
  }
}

function parseRequiredParamName(
  filename: string,
): RouteConfigParam | undefined {
  const match = filename.match(REQUIRED_PARAM_REGEX);
  if (match) {
    return {
      type: 'required',
      name: match[1]!,
    };
  }
}

function parseCatchAllParamName(
  filename: string,
): RouteConfigParam | undefined {
  const match = filename.match(CATCH_ALL_REGEX);
  if (match) {
    return {
      type: 'catch-all',
      name: match[1]!,
    };
  }
}
