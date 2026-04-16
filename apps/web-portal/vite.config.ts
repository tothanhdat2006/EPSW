import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api/documents': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/hitl': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
      '/api/ai': {
        target: 'http://localhost:8002',
        changeOrigin: true,
      },
      '/dvc-documents': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      },
      '/dvc-redacted': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      },
      '/dvc-published': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      },
    },
  },
});
