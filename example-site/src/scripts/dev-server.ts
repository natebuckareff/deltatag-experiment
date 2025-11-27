import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import { type Connect, createServer as createViteServer } from 'vite';
import { ProjectDirectory } from './project-directory.ts';
import type { PageModule } from './render.tsx';
import { findMatchingRoute, findRoutes, isNodeRoute } from './routes.ts';
import { createVirtualModulePlugin } from './vite-plugin-virtual-module.ts';

async function startServer() {
  const projectDir = ProjectDirectory.fromCwd();
  const routes = projectDir.readRoutes();

  const virtualClientPlugin = createVirtualModulePlugin();

  const vite = await createViteServer({
    mode: 'development',
    appType: 'custom',
    server: { middlewareMode: true },
    plugins: [virtualClientPlugin],
  });

  vite.watcher.on('change', file => handleChange(file));
  vite.middlewares.use((req, res, next) => handleViteRequest(req, res, next));

  async function handleViteRequest(
    req: IncomingMessage,
    res: ServerResponse,
    next: Connect.NextFunction,
  ) {
    try {
      const url = req.url || '/';

      // TODO: can we do this via fallthrough if no route matches instead?
      if (
        url.startsWith('/@') ||
        url.startsWith('/node_modules') ||
        url.includes('.')
      ) {
        return next();
      }

      await handlePageRequest(url, res, next);
    } catch (err) {
      vite.ssrFixStacktrace(err as Error);
      next(err);
    }
  }

  async function handlePageRequest(
    url: string,
    res: ServerResponse,
    next: Connect.NextFunction,
  ) {
    const match = findMatchingRoute(routes, url);

    if (!match) {
      return next();
    }

    const layouts: PageModule[] = await Promise.all(
      [match.route, ...match.ancestors]
        .filter(isNodeRoute)
        .map(route => route.layout)
        .filter(layout => layout !== undefined)
        .map(async layout => {
          const layoutPath = path.join(projectDir.projectRoot, layout);
          const layoutModule = await vite.ssrLoadModule(layoutPath);
          return {
            file: layout,
            Component: layoutModule.default,
          };
        }),
    );

    const pageModules = [
      ...layouts.map(layout => layout.file),
      match.route.index,
    ];

    const pagePath = path.join(projectDir.projectRoot, match.route.index);
    const pageModule = await vite.ssrLoadModule(pagePath);

    const { renderToHtmlAndIslands } = (await vite.ssrLoadModule(
      path.join(projectDir.projectRoot, 'src/scripts/render.tsx'),
    )) as typeof import('./render.tsx');

    let { html, islands } = renderToHtmlAndIslands({
      match,
      layouts,
      page: {
        file: match.route.index,
        Component: pageModule.default,
      },
    });

    const id = virtualClientPlugin.setRoute(match, islands, pageModules);
    const script = `<script type="module" src="${id}"></script>`;

    html = html.replace('{{links}}', ''); // styles are loaded as module dependencies
    html = html.replace('{{scripts}}', script);

    html = await vite.transformIndexHtml(url, html);

    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.end(html);
  }

  async function handleChange(file: string) {
    const relativePath = projectDir.relative(file);

    const matches = [
      ...findRoutes(routes, route => route.index === relativePath),
    ];

    if (matches.length > 0) {
      for (const match of matches) {
        virtualClientPlugin.invalidateRoute(match);
      }

      vite.ws.send({ type: 'full-reload' });
    }
  }

  const server = createHttpServer(vite.middlewares);

  server.listen('1234', () => {
    console.log('Dev server started at http://localhost:1234/');
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
