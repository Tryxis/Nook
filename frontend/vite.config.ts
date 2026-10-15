import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev: the API runs on :5205 and is proxied, so the auth cookie is same-origin.
// Build: output goes straight into the API's wwwroot so one process serves both.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5205', changeOrigin: false },
    },
  },
  build: {
    outDir: '../backend/BookNook.Api/wwwroot',
    emptyOutDir: true,
  },
})
