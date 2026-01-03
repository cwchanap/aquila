// @ts-check

import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import vercel from '@astrojs/vercel';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@aquila/dialogue': path.resolve(
          __dirname,
          '../../packages/dialogue/src'
        ),
      },
    },
  },

  integrations: [svelte()],
});
