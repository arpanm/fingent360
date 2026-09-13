import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..', '');
  return {
    plugins: [react()],
    // Contracts are a linked workspace package. Pre-bundle its parser dependencies
    // explicitly so web and worker modules share a resolved development dependency graph.
    optimizeDeps: {
      include: [
        '@fingent360/contracts > fflate',
        '@fingent360/contracts > fast-xml-parser',
      ],
    },
    server: {
      host: '127.0.0.1',
      port: Number(process.env.WEB_PORT || env.WEB_PORT || 5173),
      strictPort: true,
      proxy: {
        '/api': `http://127.0.0.1:${process.env.API_PORT || env.API_PORT || '4100'}`,
      },
    },
    preview: {
      host: '127.0.0.1',
      port: Number(process.env.PREVIEW_PORT || env.PREVIEW_PORT || 4173),
      strictPort: true,
    },
  };
});
