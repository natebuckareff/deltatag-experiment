import type { JSX } from 'solid-js';
import { HydrationScript } from 'solid-js/web';
import { PageRouter } from '../lib/router';
import { createVar } from '../tera';
import './root.css';

export default function Root(props: { children: JSX.Element }) {
  const ctx = createVar<{ links: string; scripts: string }>();

  return (
    <html lang="en">
      <head>
        <title>Test</title>
        <HydrationScript />
        {ctx.links}
      </head>
      <body>
        <PageRouter client:load />
        <div>
          <ul class="flex flex-row gap-2 p-4">
            <li>
              <a href="/">home</a>
            </li>
            <li>
              <a href="/foo">foo</a>
            </li>
            <li>
              <a href="/bar">bar</a>
            </li>
          </ul>
          <div>{props.children}</div>
        </div>
        {ctx.scripts}
      </body>
    </html>
  );
}
