import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'react-is': fileURLToPath(new URL('./src/lib/react-is-shim.ts', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['recharts'],
  },
})

