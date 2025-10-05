import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    base: '/space_apps_hackaton/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '::',
      port: 8080,
      proxy: {
        '/api-health-check': {
          target: env.VITE_API_URL_PRIMARY,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api-health-check/, ''),
        }
      }
    },
    define: {
      'process.env.VITE_API_URL_PRIMARY': JSON.stringify(env.VITE_API_URL_PRIMARY),
      'process.env.VITE_API_URL_FALLBACK': JSON.stringify(env.VITE_API_URL_FALLBACK),
    }
  };
});