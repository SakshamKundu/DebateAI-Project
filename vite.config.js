import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true // For WebSocket support
      },
      '/ws': { // Proxy WebSocket connections
        target: 'ws://localhost:3001',
        ws: true
      }
    }
  }
})