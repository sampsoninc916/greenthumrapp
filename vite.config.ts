import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // If using the Vite plugin

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/', // Example: Replace with your actual sub-directory
  // base: '/dev.thumr.com/', Comment the above line to use the sub-directory
})
