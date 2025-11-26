import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import type { NodeRoute, RoutePath } from './routes.ts';

/*
  .build
  |-- generated
  |   |-- server
  |   |   '-- entry-*.tsx
  |   '-- client
  |       '-- entry-*.tsx
  |-- server
  |   |-- <chunk>
  |   '-- .vite
  |       '-- manifest.json
  '-- client
      |-- <chunk>
      '-- .vite
          '-- manifest.json

  .output
  |-- manifest.json
  |-- static
  |   '-- <chunk>
  '-- templates
      '-- *.html
*/

export type ViteManifest = Record<string, ViteManifestChunk>;

export interface ViteManifestChunk {
  src?: string;
  file: string;
  css?: string[];
  assets?: string[];
  isEntry?: boolean;
  name?: string;
  isDynamicEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
}

export class ProjectDirectory {
  public readonly projectRoot: string;

  private constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  static fromCwd(): ProjectDirectory {
    let current = process.cwd();
    while (true) {
      const packageJson = path.join(current, 'package.json');
      if (fs.existsSync(packageJson)) {
        return new ProjectDirectory(current);
      }
      if (current === '/') {
        throw new Error('project root not found');
      }
      current = path.resolve(current, '..');
    }
  }

  static fromPath(projectPath: string): ProjectDirectory {
    return new ProjectDirectory(path.normalize(projectPath));
  }

  relative(to: string): string {
    return path.relative(this.projectRoot, to);
  }

  getBuldScriptImportPath(): string {
    // TODO: this file will eventually live in node_modules or something
    return path.join(this.projectRoot, 'src/scripts/build.ts');
  }

  readRoutes(): NodeRoute {
    const routesPath = path.join(this.projectRoot, 'routes.json');
    return JSON.parse(fs.readFileSync(routesPath, 'utf-8'));
  }

  getBuildDir(): string {
    return path.join(this.projectRoot, '.build');
  }

  getGeneratedDir(): string {
    return path.join(this.getBuildDir(), 'generated');
  }

  getServerEntriesDir(): string {
    return path.join(this.getGeneratedDir(), 'server');
  }

  getClientEntriesDir(): string {
    return path.join(this.getGeneratedDir(), 'client');
  }

  getServerEntryPath(kebabOrRoutePath: string | RoutePath): string {
    const name = getEntryName(kebabOrRoutePath);
    const filename = name + '.tsx';
    return path.join(this.getServerEntriesDir(), filename);
  }

  getServerManifestKey(kebabOrRoutePath: string | RoutePath): string {
    const entryPath = this.getServerEntryPath(kebabOrRoutePath);
    return path.relative(this.projectRoot, entryPath);
  }

  getClientEntryPath(kebabOrRoutePath: string | RoutePath): string {
    const name = getEntryName(kebabOrRoutePath);
    const filename = name + '.tsx';
    return path.join(this.getClientEntriesDir(), filename);
  }

  getClientManifestKey(kebabOrRoutePath: string | RoutePath): string {
    const entryPath = this.getClientEntryPath(kebabOrRoutePath);
    return path.relative(this.projectRoot, entryPath);
  }

  getBundleDir(): string {
    return path.join(this.getBuildDir(), 'bundle');
  }

  getServerBuildDir(): string {
    return path.join(this.getBundleDir(), 'server');
  }

  getAllBuiltServerEntries(): string[] {
    return glob.sync(path.join(this.getServerBuildDir(), 'entry-*.js'));
  }

  getServerBuildPath(filename: string): string {
    return path.join(this.getServerBuildDir(), filename);
  }

  readServerViteManifest(): ViteManifest {
    const manifestPath = path.join(
      this.getServerBuildDir(),
      '.vite',
      'manifest.json',
    );
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }

  getClientAssetDir(): string {
    return path.join(this.getBundleDir(), 'client');
  }

  getAllBuiltClientAssets(): string[] {
    return glob.sync(path.join(this.getClientAssetDir(), '*'));
  }

  getClientAssetPath(filename: string): string {
    return path.join(this.getClientAssetDir(), filename);
  }

  readClientViteManifest(): ViteManifest {
    const manifestPath = path.join(
      this.getClientAssetDir(),
      '.vite',
      'manifest.json',
    );
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }

  getOutputDir(): string {
    return path.join(this.projectRoot, '.output');
  }

  getOutputManifestPath(): string {
    return path.join(this.getOutputDir(), 'manifest.json');
  }

  getOutputStaticDir(): string {
    return path.join(this.getOutputDir(), 'static');
  }

  getOutputTemplateDir(): string {
    return path.join(this.getOutputDir(), 'templates');
  }

  getTemplatePath(kebabOrRoutePath: string | RoutePath): string {
    const name = getTemplateName(kebabOrRoutePath);
    const filename = name + '.html';
    return path.join(this.getOutputTemplateDir(), filename);
  }
}

export function getEntryName(kebabOrRoutePath: string | RoutePath): string {
  const routeKebab =
    typeof kebabOrRoutePath === 'string'
      ? kebabOrRoutePath
      : getRouteKebab(kebabOrRoutePath);
  return `entry-${routeKebab || 'index'}`;
}

export function getTemplateName(kebabOrRoutePath: string | RoutePath): string {
  const routeKebab =
    typeof kebabOrRoutePath === 'string'
      ? kebabOrRoutePath
      : getRouteKebab(kebabOrRoutePath);
  return routeKebab || 'index';
}

function getRouteKebab(routePath: RoutePath): string {
  const { ancestors, route } = routePath;
  return [...ancestors.map(a => a.path), route.path]
    .map(p => p.slice(1))
    .filter(Boolean)
    .join('-');
}
