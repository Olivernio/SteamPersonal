import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  envDir: '../',
  envPrefix: ['VITE_', 'SUPABASE_'],
  plugins: [react()],
  server: {
    proxy: {
      '/api/steamdb': {
        target: 'https://steamdb.info',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/steamdb/, '/api'),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      },
      '/api/steam-events': {
        target: 'https://store.steampowered.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/steam-events/, '/events'),
      },
      '/api/steam-store': {
        target: 'https://store.steampowered.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/steam-store/, ''),
      }
    }
  }
})
