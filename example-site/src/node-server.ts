import fs from 'node:fs';
import { createSecureServer } from 'node:http2';
import path from 'node:path';
import type { Manifest } from './scripts/manifest.ts';
import { findMatchingRoute } from './scripts/manifest.ts';

function createLink(type: string, href: string): string {
  return `<link rel="${type}" href="/assets/${href}" />`;
}

function createScript(src: string): string {
  return `<script type="module" src="/assets/${src}"></script>`;
}

const key = fs.readFileSync('localhost-key.pem');
const cert = fs.readFileSync('localhost-cert.pem');
const server = createSecureServer({ key, cert });

const outputDir = path.join(import.meta.dirname, '../.output');
const manifestPath = path.join(outputDir, 'manifest.json');
const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

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
      const assetPath = path.join(outputDir, 'static', asset);
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

    const match = findMatchingRoute(manifest.routes, requestUrl);
    const template = match?.route
      ? manifest.templates[match.route.template]
      : undefined;

    if (!match || !template) {
      stream.respond({
        'content-type': 'text/plain',
        ':status': '404',
      });
      stream.end('Not found');
      return;
    }

    const links: string[] = [];
    const scripts: string[] = [];
    const linkHeaders: string[] = [];

    links.push(...template.css.map(file => createLink('stylesheet', file)));
    links.push(
      ...template.jsImports.map(file => createLink('modulepreload', file)),
    );

    if (template.jsEntry) {
      scripts.push(createScript(template.jsEntry));
    }

    for (const file of template.css) {
      linkHeaders.push(`</assets/${file}>; rel="preload"; as="style"`);
    }

    for (const file of template.jsImports) {
      linkHeaders.push(`</assets/${file}>; rel="modulepreload"; as="script"`);
    }

    stream.additionalHeaders({
      ':status': 103,
      link: linkHeaders.join(', '),
    });

    // simulate slow html rendering to test early hints
    await new Promise(r => setTimeout(r, 1000));

    let html = fs.readFileSync(
      path.join(outputDir, 'templates', match.route.template),
      'utf-8',
    );

    html = html.replace('{{links}}', links.join('\n'));
    html = html.replace('{{scripts}}', scripts.join('\n'));

    stream.respond({
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      ':status': 200,
    });
    stream.end(html);
  } catch (error) {
    console.error(error);
  }
});

server.listen(3000, 'localhost', () => {
  console.log('https://localhost:3000');
});
