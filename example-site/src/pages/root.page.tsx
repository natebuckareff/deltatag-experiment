import type { JSX } from 'solid-js';
import { HydrationScript } from 'solid-js/web';
import type { PageConfig } from '../scripts/build';

export const page: PageConfig = {
  path: '/',
  layout: true,
};

export default function Root(props: { children: JSX.Element }) {
  return (
    <html lang="en">
      <head>
        <title>Root Layout</title>
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

        <HydrationScript />
      </body>
    </html>
  );
}
