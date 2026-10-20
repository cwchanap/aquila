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
            // Vitest 4+ dropped coverage.all, so list sources explicitly to
            // keep untested files in the report (lcov would be empty otherwise).
            // .svelte is left out: vitest can't parse uncovered Svelte files.
            include: ['src/**/*.ts'],
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
