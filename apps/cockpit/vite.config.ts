import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Necessário quando o dev server roda em container: sem isto o Vite
    // escuta só em 127.0.0.1 e nada de fora alcança.
    host: true,
  },
  build: { outDir: 'dist', sourcemap: true },
});
