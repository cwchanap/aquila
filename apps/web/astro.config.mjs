// @ts-check

import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import vercel from '@astrojs/vercel';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '../..').replaceAll('\\', '/');

function normalizeModuleId(moduleId) {
  return moduleId.replaceAll('\\', '/').replaceAll(`${workspaceRoot}/`, '');
}

function storyChunkModulesPlugin() {
  let isClientBuild = false;

  return {
    name: 'aquila:story-chunk-modules',
    apply: 'build',
    configResolved(config) {
      isClientBuild = !config.build.ssr;
    },
    generateBundle(_options, bundle) {
      if (!isClientBuild) return;

      const chunks = Object.values(bundle)
        .filter(output => output.type === 'chunk')
        .sort((left, right) => left.fileName.localeCompare(right.fileName))
        .map(chunk => [
          chunk.fileName,
          Object.keys(chunk.modules).map(normalizeModuleId).sort(),
        ]);

      this.emitFile({
        type: 'asset',
        fileName: '.vite/story-chunk-modules.json',
        source: `${JSON.stringify(
          { schemaVersion: 1, chunks: Object.fromEntries(chunks) },
          null,
          2
        )}\n`,
      });
    },
  };
}

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel({}),
  i18n: {
    locales: ['en', 'zh'],
    defaultLocale: 'en',
    routing: 'manual',
  },
  vite: {
    build: { manifest: true },
    plugins: [tailwindcss(), storyChunkModulesPlugin()],
    resolve: {
      alias: {
        '@aquila/stories': path.resolve(
          __dirname,
          '../../packages/stories/src'
        ),
      },
    },
  },

  integrations: [svelte()],
});
