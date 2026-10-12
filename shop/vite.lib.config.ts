import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The window as one module for the site to import at run time. React, three, fiber, drei and the post-processing stack
// travel inside it at the versions in package-lock.json, so it draws exactly as it does standalone whatever the site
// itself is built with. It is written straight into the site's public/shop/, beside the assets it loads.
export default defineConfig({
  // Relative, so nothing in the module assumes it is served from the root of a site. (The assets themselves are found
  // through the `assetBase` prop the site passes, not through this.)
  base: './',
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  publicDir: false,
  build: {
    outDir: '../public/shop',
    // public/shop/ also holds the textures and the other assets: leave them be.
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: false,
    lib: { entry: 'embed.tsx', formats: ['es'], fileName: () => 'shop-window.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
