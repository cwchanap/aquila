import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    test: {
        environment: 'jsdom',
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
    },
});
