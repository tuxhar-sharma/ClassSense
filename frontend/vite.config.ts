import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['periodically-nonsymbiotical-stuart.ngrok-free.dev'],
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
