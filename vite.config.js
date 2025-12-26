import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [vue()],
    base: '/',
    build: {
        outDir: 'dist',
        emptyOutDir: true
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
        // Proxy /api to local upload server during development
        proxy: {
            '/api': {
                target: 'http://localhost:8787',
                changeOrigin: true,
                secure: false,
                rewrite: (p) => p.replace(/^\/api/, '/api')
            }
        }
    }
});
