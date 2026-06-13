import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      '.a.pinggy.link',
      '.free.pinggy.net',
      '.trycloudflare.com'
    ]
  }
})
