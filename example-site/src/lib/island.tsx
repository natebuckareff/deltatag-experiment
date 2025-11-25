import type { JSX } from 'solid-js';
import { Hydration } from 'solid-js/web';

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

export function readIslandRegistry(): MapIterator<[string, IslandEntry]> {
  return islandRegistry.entries();
}

export function Island(props: IslandProps) {
  const internalProps = props as IslandInternalProps;
  if (!props.id) {
    throw Error('missing island id');
  }
  const entry = { ...internalProps.__meta, id: props.id };
  islandRegistry.set(internalProps.__meta.file, entry);
  return (
    <div id={props.id}>
      <Hydration>{props.children}</Hydration>
    </div>
  );
}
