import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Lets `npm run dev` talk to a locally running `npm run server` for the wrap
    // library. Without the server, /api probes just fail and the library hides itself.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
