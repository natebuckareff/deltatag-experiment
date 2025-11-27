import { glob } from 'glob';
import devtools from 'solid-devtools/vite';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { islandMetaPlugin } from './src/scripts/vite-plugin-island-meta';

export default defineConfig(({ mode }) => {
  if (mode === 'server') {
    return {
      plugins: [islandMetaPlugin(), devtools(), solidPlugin({ ssr: true })],
      build: {
        ssr: true,
        manifest: true,
        ssrEmitAssets: true,
        target: 'esnext',
        assetsDir: '',
        outDir: '.build/bundle/server',
        rollupOptions: {
          input: glob.sync('.build/generated/server/entry-*.tsx'),
        },
      },
      ssr: {
        noExternal: ['solid-js'],
      },
    };
  } else if (mode === 'client') {
    return {
      plugins: [islandMetaPlugin(), devtools(), solidPlugin({ ssr: false })],
      build: {
        manifest: true,
        target: 'esnext',
        assetsDir: '',
        outDir: '.build/bundle/client',
        rollupOptions: {
          input: glob.sync('.build/generated/client/entry-*.tsx'),
        },
      },
    };
  } else if (mode === 'development') {
    return {
      plugins: [islandMetaPlugin(), devtools(), solidPlugin({ ssr: true })],
      ssr: {
        noExternal: ['solid-js'],
      },
    };
  } else {
    throw new Error(`unknown build mode: ${mode}`);
  }
});
