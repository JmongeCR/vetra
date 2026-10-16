import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envPrefix: 'PUBLIC_',
  server: {
    port: 5174,
    strictPort: true,
  },
})
