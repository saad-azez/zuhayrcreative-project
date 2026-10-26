import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The atelier as one module for the site to import at run time, with React, three, fiber, drei and the
// post-processing stack inside at the versions in package-lock.json (as shop/ does for the older window). Written
// into the site's public/atelier/, beside the assets it loads.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  publicDir: false,
  build: {
    outDir: '../public/atelier',
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: false,
    lib: { entry: 'embed.tsx', formats: ['es'], fileName: () => 'atelier-window.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
