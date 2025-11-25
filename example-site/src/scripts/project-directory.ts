import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import type { NodeRoute, RoutePath } from './routes.ts';

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

  getClientEntryPath(routePath: RoutePath): string {
    const name = getEntryName(routePath);
    const filename = name + '.tsx';
    return path.join(this.getOutputDir(), 'client', filename);
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

  readRoutes(): NodeRoute {
    return JSON.parse(fs.readFileSync(this.getRoutesPath(), 'utf-8'));
  }
}

export function getEntryName(routePath: RoutePath): string {
  const routeKebab = getRouteKebab(routePath);
  return `entry-${routeKebab || 'index'}`;
}

export function getTemplateName(routePath: RoutePath): string {
  const routeKebab = getRouteKebab(routePath);
  return routeKebab || 'index';
}

function getRouteKebab(routePath: RoutePath): string {
  const { ancestors, route } = routePath;
  return [...ancestors.map(a => a.path), route.path]
    .map(p => p.slice(1))
    .filter(Boolean)
    .join('-');
}
