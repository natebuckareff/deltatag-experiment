import type { JSX } from 'solid-js';
import { renderToString } from 'solid-js/web';

export interface IslandProps {
  id?: string;
  children: JSX.Element;
}

interface IslandMeta {
  component: string;
  file: string;
  exportName: string;
}

export interface IslandEntry extends IslandMeta {
  id: string;
}

interface IslandInternalProps extends IslandProps {
  __meta: IslandMeta;
}

const islandRegistry = new Map<string, IslandEntry>();

export function resetIslandRegistry() {
  islandRegistry.clear();
}

export function readIslandRegistry(): MapIterator<IslandEntry> {
  return islandRegistry.values();
}

export function Island(props: IslandProps) {
  const internalProps = props as IslandInternalProps;
  if (!props.id) {
    throw Error('missing island id');
  }
  const entry = { ...internalProps.__meta, id: props.id };
  islandRegistry.set(props.id, entry);
  const Component = () => props.children;
  const html = renderToString(Component, { renderId: props.id });
  return <div id={props.id} innerHTML={html} />;
}
