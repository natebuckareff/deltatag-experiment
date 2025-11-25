import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import type { NodeRoute, RoutePath } from './routes.ts';

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

  getBuildDir(): string {
    return path.join(this.projectRoot, '.build');
  }

  getOutputDir(): string {
    return path.join(this.projectRoot, '.output');
  }

  getRoutesPath(): string {
    return path.join(this.projectRoot, 'routes.json');
  }

  getTemplatePath(routePath: RoutePath): string {
    const name = getTemplateName(routePath);
    const filename = name + '.html';
    return path.join(this.getOutputDir(), 'templates', filename);
  }

  getServerAssetPath(filename: string): string {
    return path.join(this.getBuildDir(), 'ssr', filename);
  }

  getClientAssetPath(filename: string): string {
    return path.join(this.getOutputDir(), 'client', filename);
  }

  getClientEntryPath(kebabOrRoutePath: string | RoutePath): string {
    const name = getEntryName(kebabOrRoutePath);
    const filename = name + '.tsx';
    return path.join(this.getBuildDir(), 'client', filename);
  }

  getServerEntryPath(kebabOrRoutePath: string | RoutePath): string {
    const name = getEntryName(kebabOrRoutePath);
    const filename = name + '.tsx';
    return path.join(this.getBuildDir(), 'server', filename);
  }

  getClientManifestKey(kebabOrRoutePath: string | RoutePath): string {
    const entryPath = this.getClientEntryPath(kebabOrRoutePath);
    return path.relative(this.projectRoot, entryPath);
  }

  getServerManifestKey(kebabOrRoutePath: string | RoutePath): string {
    const entryPath = this.getServerEntryPath(kebabOrRoutePath);
    return path.relative(this.projectRoot, entryPath);
  }

  getBuldScriptImportPath(): string {
    // TODO: this file will eventually live in node_modules or something
    return path.join(this.projectRoot, 'src/scripts/build.ts');
  }

  getServerEntriesDir(): string {
    return path.join(this.getBuildDir(), 'server');
  }

  getAllBuiltServerEntries(): string[] {
    const buildDir = this.getBuildDir();
    return glob.sync(path.join(buildDir, 'ssr/entry-*.js'));
  }

  getManifestPath(): string {
    return path.join(this.getOutputDir(), 'manifest.json');
  }

  readRoutes(): NodeRoute {
    return JSON.parse(fs.readFileSync(this.getRoutesPath(), 'utf-8'));
  }

  readServerManifest(): ViteManifest {
    const manifestPath = path.join(
      this.getBuildDir(),
      'ssr',
      '.vite',
      'manifest.json',
    );
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }

  readClientManifest(): ViteManifest {
    const manifestPath = path.join(
      this.getOutputDir(),
      'client',
      '.vite',
      'manifest.json',
    );
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
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
