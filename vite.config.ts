import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), viteSingleFile(), tailwindcss()],
  server: {
    port: 5173,
    host: 'localhost',
    cors: true,
    proxy: {
      '/api': {
        target: 'http://10.10.60.8:1669',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, _req, _res) => {
            // Add CORS headers to proxy requests
            proxyReq.setHeader('Access-Control-Allow-Origin', '*');
            proxyReq.setHeader('Access-Control-Allow-Credentials', 'true');
          });
        }
      }
    }
  },
  build: {
    outDir: 'Distribution',
    assetsInlineLimit: 0, // Ensure fonts are properly handled
  },
  assetsInclude: ['**/*.ttf', '**/*.otf', '**/*.woff', '**/*.woff2'],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      process: 'process/browser',
      util: 'util',
    },
  },
  optimizeDeps: {
    include: ['buffer', 'process'],
  },
})