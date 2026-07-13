import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@server': path.resolve(__dirname, '../server/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res) {
              (res as any).writeHead(503, {
                'Content-Type': 'application/json',
              });
              (res as any).end(
                JSON.stringify({ error: '后端服务重启中，请稍后重试...' }),
              );
            }
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
