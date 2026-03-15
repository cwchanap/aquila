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
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'json'],
            reportsDirectory: './coverage',
        },
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            'astro:middleware': resolve(
                __dirname,
                './src/lib/test-utils/astro-middleware-stub.ts'
            ),
        },
        conditions: ['browser'],
    },
});
