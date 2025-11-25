import assert from 'node:assert';
import fs from 'node:fs';
import { createSecureServer } from 'node:http2';
import path from 'node:path';
import {
  getRouteEntryName,
  getRouteTemplateName,
  readConfigRoutes,
} from './scripts/lib.ts';
import { findMatchingRoute } from './scripts/routes.ts';

interface Config {
  buildDir: string;
  outputDir: string;
}

type ViteManifest = Record<string, ViteManifestChunk>;

interface ViteManifestChunk {
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

function readServerManifest(config: Config): ViteManifest {
  const manifestPath = path.join(
    config.buildDir,
    'ssr',
    '.vite',
    'manifest.json',
  );
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
}

function readClientManifest(config: Config): ViteManifest {
  const manifestPath = path.join(
    config.outputDir,
    'client',
    '.vite',
    'manifest.json',
  );
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
}

function getChunks(manifest: ViteManifest, name: string): ViteManifestChunk[] {
  const seen = new Set<string>([name]);

  const getChunks = (chunk: ViteManifestChunk): ViteManifestChunk[] => {
    const chunks: ViteManifestChunk[] = [];

    if (chunk.imports) {
      for (const file of chunk.imports) {
        if (seen.has(file)) {
          continue;
        }
        seen.add(file);

        const importee = manifest[file];
        if (!importee) {
          throw new Error(`manifest key not found`);
        }

        chunks.push(...getChunks(importee));
        chunks.push(importee);
      }
    }

    return chunks;
  };

  const chunk = manifest[name];

  if (!chunk) {
    throw new Error(`manifest key not found`);
  }

  return [chunk, ...getChunks(chunk)];
}

function createLink(type: string, href: string): string {
  return `<link rel="${type}" href="/assets/${href}" />`;
}

function createScript(src: string): string {
  return `<script type="module" src="/assets/${src}"></script>`;
}

const config: Config = {
  buildDir: path.join(import.meta.dirname, '../.build'),
  outputDir: path.join(import.meta.dirname, '../.output'),
};

const key = fs.readFileSync('localhost-key.pem');
const cert = fs.readFileSync('localhost-cert.pem');

const server = createSecureServer({ key, cert });

const routes = readConfigRoutes();
const serverManifest = readServerManifest(config);
const clientManifest = readClientManifest(config);

server.on('stream', async (stream, headers) => {
  try {
    const requestUrl = headers[':path'];

    if (!requestUrl) {
      stream.respond({
        'content-type': 'text/plain',
        ':status': '404',
      });
      stream.end('Not found');
      return;
    }

    if (requestUrl.startsWith('/assets/')) {
      console.log('ASSET_REQUEST', requestUrl);

      const asset = requestUrl.slice('/assets/'.length);

      // TODO: very gross and hacky, can do better with static asset path mappings
      let assetPath = path.join(config.outputDir, 'client', asset);
      if (!fs.existsSync(assetPath)) {
        assetPath = path.join(config.buildDir, 'ssr', asset);
      }

      const assetExt = path.extname(assetPath);
      const contentTypes: Record<string, string> = {
        '.css': 'text/css',
        '.js': 'application/javascript',
      };

      const assetContent =
        asset === 'style.css'
          ? 'body { background: pink }'
          : fs.readFileSync(assetPath, 'utf-8');

      stream.respond({
        'content-type': contentTypes[assetExt] ?? 'text/plain',
        'cache-control': 'public, max-age=3600',
        ':status': '200',
      });
      stream.end(assetContent);
      return;
    }

    const [ancestors, route] = findMatchingRoute(routes, requestUrl);

    if (!route) {
      stream.respond({
        'content-type': 'text/plain',
        ':status': '404',
      });
      stream.end('Not found');
      return;
    }

    const templateName = getRouteTemplateName(ancestors, route);
    const entryName = getRouteEntryName(ancestors, route);

    const clientEntry = `.build/client/${entryName}.tsx`;
    const serverEntry = `.build/server/${entryName}.tsx`;

    const clientChunks = getChunks(clientManifest, clientEntry);
    const serverChunks = getChunks(serverManifest, serverEntry);

    assert(clientChunks[0]?.isEntry);
    assert(serverChunks[0]?.isEntry);

    // <link rel="stylesheet" href="{file}" />
    const cssImported = Array.from(
      new Set([
        ...clientChunks.flatMap(chunk => chunk.css ?? []),
        ...serverChunks.flatMap(chunk => chunk.css ?? []),
      ]),
    );

    const jsEntry = clientChunks[0].file;
    const jsImported = clientChunks.slice(1).flatMap(chunk => chunk.file);

    const dynamic = clientChunks
      .flatMap(chunk => chunk.dynamicImports ?? [])
      .map(key => clientManifest[key]?.file)
      .filter((file): file is string => file !== undefined);

    const links: string[] = [];
    const scripts: string[] = [];
    const linkHeaders: string[] = [];

    links.push(...cssImported.map(file => createLink('stylesheet', file)));
    links.push(...jsImported.map(file => createLink('modulepreload', file)));
    links.push(...dynamic.map(file => createLink('modulepreload', file)));
    scripts.push(createScript(jsEntry));

    for (const file of cssImported) {
      linkHeaders.push(`</assets/${file}>; rel="preload"; as="style"`);
    }

    for (const file of jsImported) {
      linkHeaders.push(`</assets/${file}>; rel="modulepreload"; as="script"`);
    }

    for (const file of dynamic) {
      linkHeaders.push(`</assets/${file}>; rel="modulepreload"; as="script"`);
    }

    stream.additionalHeaders({
      ':status': 103,
      link: linkHeaders.join(', '),
    });

    // simulate slow html rendering to test early hints
    await new Promise(r => setTimeout(r, 1000));

    let template = fs.readFileSync(
      path.join(config.outputDir, 'templates', templateName + '.html'),
      'utf-8',
    );

    template = template.replace('{{links}}', links.join('\n'));
    template = template.replace('{{scripts}}', scripts.join('\n'));

    stream.respond({
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      ':status': 200,
    });
    stream.end(template);
  } catch (error) {
    console.error(error);
  }
});

server.listen(3000, 'localhost', () => {
  console.log('https://localhost:3000');
});
