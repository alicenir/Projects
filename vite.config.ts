import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Lets `npm run dev` reach a locally running `npm run server`, which relays
    // Grok requests to xAI. Gemini calls go straight to Google and don't need it.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
