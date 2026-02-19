import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
    plugins: [svelte()],
    test: {
        environment: 'happy-dom',
        globals: true,
        passWithNoTests: true,
        setupFiles: ['./src/lib/test-setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'json'],
            reportsDirectory: './coverage',
            exclude: [
                'svelte.config.js',
                'vite.config.js',
                'vitest.config.ts',
                '.svelte-kit/**',
                'build/**',
                '.output/**',
                'src-tauri/**',
                '**/*.d.ts',
                'src/lib/test-setup.ts',
            ],
        },
    },
    resolve: {
        alias: {
            '@aquila/assets': resolve(__dirname, '../../packages/assets/media'),
        },
        conditions: ['browser'],
    },
});
