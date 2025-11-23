/* @refresh reload */
import { hydrate } from 'solid-js/web';
import 'solid-devtools';

import { App } from './app';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error('Root element not found');
}

hydrate(() => <App />, root!);
