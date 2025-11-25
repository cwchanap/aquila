import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
    plugins: [svelte()],
    test: {
        environment: 'happy-dom',
        globals: true,
        setupFiles: ['./src/lib/test-setup.ts'],
        exclude: [
            '**/node_modules/**',
            '**/tests/**', // Exclude Playwright tests
            '**/*.spec.ts', // Exclude Playwright test files
        ],
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
        conditions: ['browser'],
    },
});
