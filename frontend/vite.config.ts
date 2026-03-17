import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isGhPages = process.env.GITHUB_PAGES === 'true'

export default defineConfig({
  base: isGhPages ? '/cypher/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false
  },
  build: {
    target: 'esnext',
    minify: 'terser'
  }
})
