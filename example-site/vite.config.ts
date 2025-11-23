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
        target: 'esnext',
        outDir: '.build/ssr',
        rollupOptions: {
          input: '.build/entry-server.tsx',
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
        outDir: '.output/client',
        rollupOptions: {
          input: glob.sync('.build/client/entry-*.tsx'),
        },
      },
    };
  } else {
    throw new Error(`unknown build mode: ${mode}`);
  }
});
