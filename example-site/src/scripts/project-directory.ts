import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import type { NodeRoute, RouteMatch } from './routes.ts';
import { getRouteMatchPath } from './routes.ts';

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

  static fromDir(dir: string): ProjectDirectory {
    let current = dir;
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

  static fromCwd(): ProjectDirectory {
    const cwd = process.cwd();
    return ProjectDirectory.fromDir(path.normalize(cwd));
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

  getServerEntryPath(kebabOrMatch: string | RouteMatch): string {
    const name = getEntryName(kebabOrMatch);
    const filename = name + '.tsx';
    return path.join(this.getServerEntriesDir(), filename);
  }

  getServerManifestKey(kebabOrMatch: string | RouteMatch): string {
    const entryPath = this.getServerEntryPath(kebabOrMatch);
    return path.relative(this.projectRoot, entryPath);
  }

  getClientEntryPath(kebabOrMatch: string | RouteMatch): string {
    const name = getEntryName(kebabOrMatch);
    const filename = name + '.tsx';
    return path.join(this.getClientEntriesDir(), filename);
  }

  getClientManifestKey(kebabOrMatch: string | RouteMatch): string {
    const entryPath = this.getClientEntryPath(kebabOrMatch);
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

  getTemplatePath(kebabOrMatch: string | RouteMatch): string {
    const name = getTemplateName(kebabOrMatch);
    const filename = name + '.html';
    return path.join(this.getOutputTemplateDir(), filename);
  }
}

export function getEntryName(kebabOrMatch: string | RouteMatch): string {
  const routeKebab =
    typeof kebabOrMatch === 'string'
      ? kebabOrMatch
      : getRouteKebab(kebabOrMatch);
  return `entry-${routeKebab || 'index'}`;
}

export function getTemplateName(kebabOrMatch: string | RouteMatch): string {
  const routeKebab =
    typeof kebabOrMatch === 'string'
      ? kebabOrMatch
      : getRouteKebab(kebabOrMatch);
  return routeKebab || 'index';
}

function getRouteKebab(match: RouteMatch): string {
  return getRouteMatchPath(match).join('-');
}
