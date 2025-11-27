import { JSX } from 'solid-js';
import { NoHydration, renderToString } from 'solid-js/web';
import {
  IslandEntry,
  readIslandRegistry,
  resetIslandRegistry,
} from '../lib/island';
import { RouteMatch } from './routes';

export interface PageModule {
  file: string;
  Component: (props?: { children?: JSX.Element }) => JSX.Element;
}

export interface RenderParams {
  match: RouteMatch;
  layouts: PageModule[];
  page: PageModule;
}

export interface RenderResult {
  html: string;
  islands: IslandEntry[];
}

export function renderToHtmlAndIslands(params: RenderParams): RenderResult {
  resetIslandRegistry();

  const Component = getComposedComponents(params.layouts, params.page);
  const html = `<!doctype html>${renderToString(Component)}`;
  const islands = Array.from(readIslandRegistry());

  return { html, islands };
}

function getComposedComponents(
  layoutPages: PageModule[],
  indexPage: PageModule,
): () => JSX.Element {
  const components = [...layoutPages, indexPage];

  const Composed = (props?: { children?: JSX.Element }) => {
    return components.reduceRight<JSX.Element>(
      (child, { Component }) => <Component>{child}</Component>,
      props?.children,
    );
  };

  return () => (
    <NoHydration>
      <Composed />
    </NoHydration>
  );
}
