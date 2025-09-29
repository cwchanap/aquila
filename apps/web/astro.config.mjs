// @ts-check

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import vercel from '@astrojs/vercel/serverless';

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
  },

  integrations: [svelte()],
});
