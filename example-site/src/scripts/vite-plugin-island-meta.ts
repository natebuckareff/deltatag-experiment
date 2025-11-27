import crypto from 'node:crypto';
import path from 'node:path';
import type {
  ImportDeclaration,
  ImportDeclarationSpecifier,
  JSXAttribute,
  JSXAttributeName,
  JSXElement,
  JSXElementName,
  Program,
} from '@oxc-project/types';
import { parseSync, Visitor } from 'oxc-parser';
import type { Plugin } from 'vite';

interface ImportInfo {
  file: string;
  exportName: string;
}

interface CollectedImports {
  named: Map<string, ImportInfo>;
  namespaces: Map<string, string>;
  hasIsland: boolean;
  lastImportEnd: number | null;
}

interface Replacement {
  start: number;
  end: number;
  content: string;
}

interface ClientDirectiveMatch {
  element: JSXElement;
  attributes: JSXAttribute[];
}

const CLIENT_NAMESPACE = 'client';

function stripQuery(id: string): string {
  return id.split('?', 1)[0] ?? id;
}

function findSrcRoot(filePath: string): string | null {
  const parts = stripQuery(filePath).split(path.sep);
  const index = parts.lastIndexOf('src');
  return index === -1 ? null : parts.slice(0, index + 1).join(path.sep);
}

function ensureExtension(p: string): string {
  return /\.[mc]?[tj]sx?$/.test(p) ? p : `${p}.tsx`;
}

function normalizeToProjectPath(
  importPath: string,
  currentFileId: string,
): string {
  if (!importPath.startsWith('.')) {
    return importPath;
  }

  const absolutePath = path.resolve(
    path.dirname(stripQuery(currentFileId)),
    importPath,
  );
  const srcRoot = findSrcRoot(currentFileId);
  if (!srcRoot) {
    return importPath;
  }

  const relative = path.relative(srcRoot, absolutePath);
  if (relative.startsWith('..')) {
    return importPath;
  }

  const normalized = relative.replace(/\\/g, '/');
  return ensureExtension(`src/${normalized}`);
}

function generateIslandId(
  file: string,
  component: string,
  sourceLocation: number,
): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${file}:${component}:${sourceLocation}`)
    .digest('hex')
    .slice(0, 8);

  return `island-${hash}`;
}

function jsxNameToString(name: JSXElementName): string {
  if (name.type === 'JSXIdentifier') {
    return name.name;
  }

  if (name.type === 'JSXMemberExpression') {
    const object =
      name.object.type === 'JSXIdentifier'
        ? name.object.name
        : jsxNameToString(name.object);
    return `${object}.${name.property.name}`;
  }

  return `${name.namespace.name}:${name.name.name}`;
}

function collectImports(program: Program, id: string): CollectedImports {
  const named = new Map<string, ImportInfo>();
  const namespaces = new Map<string, string>();
  let hasIsland = false;
  let lastImportEnd: number | null = null;

  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration') continue;

    lastImportEnd = node.end;
    const importDecl = node as ImportDeclaration;
    const sourceValue = importDecl.source.value;
    const normalizedPath = normalizeToProjectPath(sourceValue, id);

    for (const specifier of importDecl.specifiers) {
      const spec = specifier as ImportDeclarationSpecifier;
      if (spec.type === 'ImportSpecifier') {
        const exportName =
          spec.imported.type === 'Identifier'
            ? spec.imported.name
            : spec.imported.value;
        named.set(spec.local.name, {
          file: normalizedPath,
          exportName,
        });
        if (spec.local.name === 'Island') {
          hasIsland = true;
        }
      } else if (spec.type === 'ImportDefaultSpecifier') {
        named.set(spec.local.name, {
          file: normalizedPath,
          exportName: 'default',
        });
      } else if (spec.type === 'ImportNamespaceSpecifier') {
        namespaces.set(spec.local.name, normalizedPath);
      }
    }
  }

  return { named, namespaces, hasIsland, lastImportEnd };
}

function resolveComponentImport(
  name: JSXElementName,
  imports: CollectedImports,
): ImportInfo | undefined {
  if (name.type === 'JSXIdentifier') {
    return imports.named.get(name.name);
  }

  if (name.type === 'JSXMemberExpression') {
    const base =
      name.object.type === 'JSXIdentifier'
        ? name.object.name
        : jsxNameToString(name.object);
    const file = imports.namespaces.get(base);
    if (!file) return undefined;
    return { file, exportName: name.property.name };
  }

  return undefined;
}

function isDomLikeName(name: JSXElementName): boolean {
  return name.type === 'JSXIdentifier' && /^[a-z]/.test(name.name);
}

function getClientDirectiveAttributes(attrs: JSXAttribute[]): JSXAttribute[] {
  return attrs.filter(attr => {
    if (attr.type !== 'JSXAttribute') return false;
    const name = attr.name as JSXAttributeName;
    return (
      name.type === 'JSXNamespacedName' &&
      name.namespace.name === CLIENT_NAMESPACE
    );
  });
}

function applyReplacements(code: string, replacements: Replacement[]): string {
  const sorted = [...replacements].sort((a, b) => a.start - b.start);

  let result = '';
  let lastIndex = 0;

  for (const replacement of sorted) {
    if (replacement.start < lastIndex) {
      throw new Error('[island-meta] overlapping replacements detected');
    }
    result += code.slice(lastIndex, replacement.start) + replacement.content;
    lastIndex = replacement.end;
  }

  result += code.slice(lastIndex);
  return result;
}

function removeClientAttributes(
  source: string,
  baseOffset: number,
  attributes: JSXAttribute[],
): string {
  const removals: Replacement[] = attributes.map(attr => {
    const start = (() => {
      let cursor = attr.start - baseOffset;
      while (cursor > 0 && /\s/.test(source.charAt(cursor - 1))) {
        cursor -= 1;
      }
      return cursor;
    })();
    return { start, end: attr.end - baseOffset, content: '' };
  });

  return applyReplacements(source, removals);
}

function insertIslandImport(
  code: string,
  id: string,
  insertAfter: number | null,
): Replacement {
  const filePath = stripQuery(id);
  const fileDir = path.dirname(filePath);
  const srcRoot = findSrcRoot(filePath);
  const islandPath = srcRoot
    ? path.join(srcRoot, 'lib', 'island')
    : path.resolve(fileDir, '../lib/island');

  let relative = path.relative(fileDir, islandPath).replace(/\\/g, '/');
  if (!relative.startsWith('.')) {
    relative = `./${relative}`;
  }

  return {
    start: insertAfter ?? 0,
    end: insertAfter ?? 0,
    content: `import { Island } from '${relative}';\n`,
  };
}

export function islandMetaPlugin(): Plugin {
  return {
    name: 'island-meta',
    enforce: 'pre',

    transform(code: string, id: string) {
      if (!id.endsWith('.tsx') && !id.endsWith('.jsx')) {
        return null;
      }

      if (!code.includes('client:')) {
        return null;
      }

      let parsed;
      try {
        parsed = parseSync(id, code, { sourceType: 'module', range: true });
      } catch (error) {
        this.warn(`[island-meta] failed to parse ${id}: ${String(error)}`);
        return null;
      }

      if (parsed.errors.length > 0) {
        this.warn(
          `[island-meta] skipping ${id} due to parse errors:\n${parsed.errors
            .map(e => e.message)
            .join('\n')}`,
        );
        return null;
      }

      const imports = collectImports(parsed.program as Program, id);
      const clientElements: ClientDirectiveMatch[] = [];

      new Visitor({
        JSXElement(node: JSXElement) {
          const opening = node.openingElement;
          const clientAttrs = getClientDirectiveAttributes(
            opening.attributes as JSXAttribute[],
          );

          if (clientAttrs.length > 0) {
            clientElements.push({ element: node, attributes: clientAttrs });
          }
        },
      }).visit(parsed.program as Program);

      const replacements: Replacement[] = [];
      let needsIslandImport = !imports.hasIsland && clientElements.length > 0;

      for (const { element, attributes } of clientElements) {
        const name = element.openingElement.name;
        if (isDomLikeName(name)) {
          continue;
        }

        const componentImport = resolveComponentImport(name, imports);
        if (!componentImport) {
          this.warn(
            `[island-meta] unable to resolve import for ${jsxNameToString(name)} in ${id}`,
          );
          continue;
        }

        const customIdAttr = attributes.find(attr => {
          const attrName = attr.name as JSXAttributeName;
          return (
            attrName.type === 'JSXNamespacedName' && attrName.name.name === 'id'
          );
        });

        const customId =
          customIdAttr &&
          customIdAttr.value &&
          customIdAttr.value.type === 'Literal' &&
          typeof customIdAttr.value.value === 'string'
            ? customIdAttr.value.value
            : undefined;

        const islandId =
          customId ??
          generateIslandId(
            componentImport.file,
            jsxNameToString(name),
            element.start,
          );

        const elementSource = code.slice(element.start, element.end);
        const sanitized = removeClientAttributes(
          elementSource,
          element.start,
          attributes,
        );

        const meta = `__meta={{ component: "${jsxNameToString(
          name,
        )}", file: "${componentImport.file}", exportName: "${componentImport.exportName}" }}`;
        const replacement = `<Island id="${islandId}" ${meta}>${sanitized}</Island>`;

        replacements.push({
          start: element.start,
          end: element.end,
          content: replacement,
        });
      }

      if (needsIslandImport) {
        replacements.push(
          insertIslandImport(code, id, imports.lastImportEnd ?? null),
        );
      }

      if (replacements.length === 0) {
        return null;
      }

      return {
        code: applyReplacements(code, replacements),
      };
    },
  };
}
