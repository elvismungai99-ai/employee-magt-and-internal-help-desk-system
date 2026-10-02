import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.PORT || env.VITE_PORT) || 5173;
  const backendUrl = env.VITE_BACKEND_URL || env.BACKEND_URL || 'http://localhost:8080';

  return {
    plugins: [react()],
    server: {
      port,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true
        }
      }
    }
  };
});
