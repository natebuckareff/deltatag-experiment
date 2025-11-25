import type { JSX } from 'solid-js';
import { HydrationScript } from 'solid-js/web';
import type { PageConfig } from '../scripts/build';
import { createVar } from '../tera';

export const page: PageConfig = {
  path: '/',
  layout: true,
};

export default function Root(props: { children: JSX.Element }) {
  const ctx = createVar<{ links: string; scripts: string }>();

  return (
    <html lang="en">
      <head>
        <title>Root Layout</title>
        <HydrationScript />
        {ctx.links}
      </head>
      <body>
        <div>
          <p>root layout</p>
          <ul>
            <li>
              <a href="/">home</a>
            </li>
            <li>
              <a href="/login">login</a>
            </li>
            <li>
              <a href="/dashboard">dashboard</a>
            </li>
          </ul>
          <div>{props.children}</div>
        </div>
        {ctx.scripts}
      </body>
    </html>
  );
}
