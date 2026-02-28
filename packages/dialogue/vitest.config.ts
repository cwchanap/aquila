import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/__tests__/**',
                'src/**/*.test.ts',
                'src/index.ts',
                'src/characters/index.ts',
            ],
            reporter: ['text', 'lcov'],
        },
    },
});
