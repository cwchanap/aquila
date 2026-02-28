import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['src/**/*.test.ts'],
        setupFiles: ['src/__tests__/setup.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/__tests__/**',
                'src/**/*.test.ts',
                'src/index.ts',
            ],
            reporter: ['text', 'lcov'],
        },
    },
    resolve: {
        alias: {
            // Redirect all `import Phaser from 'phaser'` to the test mock so
            // Phaser-dependent classes can be unit-tested without a real renderer.
            phaser: resolve(__dirname, 'src/__tests__/phaserMock.ts'),
        },
    },
});
