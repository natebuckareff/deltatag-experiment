// vite-plugin-island-meta.ts
import crypto from 'node:crypto';
import path from 'node:path';
import type { Plugin } from 'vite';

interface ImportInfo {
  file: string;
  exportName: string;
}

function generateIslandId(
  file: string,
  component: string,
  sourceLocation: number,
): string {
  // Hash based on file path, component, and position in source
  const hash = crypto
    .createHash('sha256')
    .update(`${file}:${component}:${sourceLocation}`)
    .digest('hex')
    .slice(0, 8);

  return `island-${hash}`;
}

function normalizeToProjectPath(
  importPath: string,
  currentFileId: string,
): string {
  // If already normalized or an alias, return as-is
  if (!importPath.startsWith('.')) {
    return importPath;
  }

  // Resolve to absolute path
  const currentDir = path.dirname(currentFileId);
  const absolutePath = path.resolve(currentDir, importPath);

  // Find project root by looking for src/ in the path
  const pathParts = absolutePath.split(path.sep);
  const srcIndex = pathParts.indexOf('src');

  if (srcIndex === -1) {
    console.warn('[island-meta] Could not find src/ in path:', absolutePath);
    return importPath; // Fallback to original
  }

  // Get path from src/ onwards
  const fromSrc = pathParts.slice(srcIndex).join('/'); // Always use forward slashes

  // Add .tsx if not present (handles import path → file path)
  if (!fromSrc.endsWith('.tsx') && !fromSrc.endsWith('.ts')) {
    return fromSrc + '.tsx';
  }

  return fromSrc;
}

export function islandMetaPlugin(): Plugin {
  return {
    name: 'island-meta',
    enforce: 'pre',

    transform(code: string, id: string) {
      if (!id.endsWith('.tsx') || !code.includes('<Island')) {
        return null;
      }

      // Track both regular imports and namespace imports
      const imports = new Map<string, ImportInfo>();
      const namespaces = new Map<string, string>(); // namespace → file path

      // Regular named/default imports
      const importRegex =
        /import\s+(?:(?:\{([^}]+)\})|(\w+))\s+from\s+['"]([^'"]+)['"]/g;

      for (const match of code.matchAll(importRegex)) {
        const [, named, defaultImport, source] = match;

        // Normalize the path
        const normalizedPath = normalizeToProjectPath(source, id);

        if (named) {
          const names = named.split(',').map(s => s.trim());
          for (const name of names) {
            const parts = name.split(/\s+as\s+/);
            const exportName = parts[0].trim();
            const localName =
              parts.length > 1 ? parts[1].trim() : parts[0].trim();
            imports.set(localName, { file: normalizedPath, exportName });
          }
        }
        if (defaultImport) {
          imports.set(defaultImport, {
            file: normalizedPath,
            exportName: 'default',
          });
        }
      }

      // Namespace imports: import * as Name from 'path'
      const namespaceRegex =
        /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;

      for (const match of code.matchAll(namespaceRegex)) {
        const [, namespaceName, source] = match;

        // Normalize the path
        const normalizedPath = normalizeToProjectPath(source, id);

        namespaces.set(namespaceName, normalizedPath);
      }

      // Find both simple and member expression islands:
      // <Island ...> <ComponentName /> OR <Island ...> <Namespace.Component />
      const islandRegex = /<Island(\s+[^>]*)?\s*>\s*<([\w.]+)/g;

      let transformed = code;
      let offset = 0;

      for (const match of code.matchAll(islandRegex)) {
        const [fullMatch, attributes, componentRef] = match;

        let importInfo: ImportInfo | undefined;

        // Check if it's a member expression (Namespace.Component)
        if (componentRef.includes('.')) {
          const [namespaceName, exportName] = componentRef.split('.');
          const file = namespaces.get(namespaceName);
          if (file) {
            importInfo = { file, exportName };
          }
        } else {
          // Simple identifier
          importInfo = imports.get(componentRef);
        }

        if (importInfo) {
          // Check if user provided an id attribute
          // const userIdMatch = attributes.match(/id=["']([^"']+)["']/);
          const userIdMatch = attributes
            ? attributes.match(/id=["']([^"']+)["']/)
            : null;

          const islandId = userIdMatch
            ? userIdMatch[1]
            : generateIslandId(importInfo.file, componentRef, match.index!);

          // Build the props to inject
          let propsToInject = ` __meta={{ component: "${componentRef}", file: "${importInfo.file}", exportName: "${importInfo.exportName}" }}`;

          // If no user-provided id, inject it
          if (!userIdMatch) {
            propsToInject = ` id="${islandId}"` + propsToInject;
          }

          // FIXED: Find the position right before the closing '>' of <Island ...>
          const islandTagMatch = code
            .slice(match.index!)
            .match(/<Island[^>]*>/);

          if (!islandTagMatch) {
            continue;
          }

          const insertPos =
            match.index! + islandTagMatch[0].length - 1 + offset;

          transformed =
            transformed.slice(0, insertPos) +
            propsToInject +
            transformed.slice(insertPos);

          offset += propsToInject.length;
        }
      }

      return transformed === code ? null : { code: transformed };
    },
  };
}
