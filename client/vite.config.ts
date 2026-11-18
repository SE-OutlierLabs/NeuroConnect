import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The dev server forwards /api/* to the Express server, so the browser sees ONE origin
// and the session cookie just works (no CORS or SameSite headaches in development).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
})
