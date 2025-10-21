import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'AquilaGame',
            formats: ['es'],
            fileName: 'index',
        },
        rollupOptions: {
            // Externalize dependencies that shouldn't be bundled
            external: ['phaser', '@aquila/dialogue', '@aquila/assets'],
            output: {
                // Preserve module structure for tree-shaking
                preserveModules: true,
                preserveModulesRoot: 'src',
                entryFileNames: '[name].js',
                // Put everything in dist/
                dir: 'dist',
            },
        },
        sourcemap: true,
        // Target modern browsers
        target: 'es2022',
        // Clear output directory before build
        emptyOutDir: true,
    },
    resolve: {
        alias: {
            '@aquila/assets': resolve(__dirname, '../assets'),
        },
    },
});
