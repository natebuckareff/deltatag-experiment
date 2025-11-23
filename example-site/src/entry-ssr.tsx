// src/entry-ssr.tsx
import { renderToString, generateHydrationScript } from 'solid-js/web';
import { App } from './app';

export function renderIslandApp() {
  const html = renderToString(() => <App />); // renders loading state if you use Suspense
  const hydrationScript = generateHydrationScript(); // global script, used once per page
  return { html, hydrationScript };
}
