import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // If using the Vite plugin
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
const enableVisualizer = process.env.ANALYZE === 'true'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(enableVisualizer
      ? [
          visualizer({
            filename: 'dist/bundle-visualizer.html',
            template: 'treemap',
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  base: '/', // Example: Replace with your actual sub-directory
  // base: '/dev.thumr.com/', // Comment the above line to use the dev sub-directory
  // base: '/stage.thumr.com/', // Comment the above line to use the stage sub-directory
  // base: '/thumr.com/', // Comment the above line to use the production sub-directory
})
