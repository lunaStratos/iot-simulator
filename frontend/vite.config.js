import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 41235,
    proxy: {
      '/api': {
        target: 'http://localhost:41234',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:41234',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    outDir: '../backend/public',
    emptyOutDir: true
  }
})
