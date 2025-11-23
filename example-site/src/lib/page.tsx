import type { JSX } from 'solid-js';
import { NoHydration } from 'solid-js/web';

// XXX
// need to pass in the page id and other stuff
// current this is going to be used internally by the build script, but it
// should probably be used explicitly by pages?
export function Page(props: { children: JSX.Element }) {
  return <NoHydration>{props.children}</NoHydration>;
}
