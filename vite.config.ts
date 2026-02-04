import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
    root: 'src',
    publicDir: resolve(__dirname, 'src/assets'),
    plugins: [
        webExtension({
            manifest: mode === 'firefox' ? 'manifest.firefox.json' : 'manifest.json',
            watchFilePaths: ['**/*'],
            webExtConfig: {
                startUrl: 'https://intra.epitech.eu',
            },
        }),
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    build: {
        outDir: resolve(__dirname, 'dist'),
        emptyOutDir: true,
        sourcemap: process.env.NODE_ENV === 'development',
    },
}));
