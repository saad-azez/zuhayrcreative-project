import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/**
 * three r169 sends matrix-array uniforms (spotLightMatrix[], directionalShadowMatrix[], pointShadowMatrix[]) to the GPU on every
 * material switch, unlike single matrices, which it skips when unchanged: they are not among the light uniforms it marks as
 * already sent, and their setter has no cache. With nine shadowed spots that was ~1,070 uploads of 9 matrices a frame, nearly
 * all the same values (31 Oct, frame cost). This gives those two setters the same "skip if unchanged" cache the single-matrix
 * setters use (the uniform object already carries an unused `cache`), so the GPU receives exactly the same values.
 */
function cacheMatrixArrayUniforms(): Plugin {
  const fix = (n: 3 | 4, size: 9 | 16) => [
    `function setValueM${n}Array( gl, v ) {\n\n\tconst data = flatten( v, this.size, ${size} );\n\n\tgl.uniformMatrix${n}fv( this.addr, false, data );\n\n}`,
    `function setValueM${n}Array( gl, v ) {\n\n\tconst data = flatten( v, this.size, ${size} );\n\n\tif ( arraysEqual( this.cache, data ) ) return;\n\n\tgl.uniformMatrix${n}fv( this.addr, false, data );\n\n\tcopyArray( this.cache, data );\n\n}`,
  ]
  return {
    name: 'cache-matrix-array-uniforms',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('three/build/three.module.js')) return null
      let out = code
      for (const [from, to] of [fix(3, 9), fix(4, 16)]) {
        // Fail the build rather than ship without it if a three update changes these lines.
        if (!out.includes(from)) throw new Error('cache-matrix-array-uniforms: setter not found in three.module.js')
        out = out.replace(from, to)
      }
      return { code: out, map: null }
    },
  }
}

// The atelier as one module for the site to import at run time, with React, three, fiber, drei and the
// post-processing stack inside at the versions in package-lock.json (as shop/ does for the older window). Written
// into the site's public/atelier/, beside the assets it loads.
export default defineConfig({
  base: './',
  plugins: [react(), cacheMatrixArrayUniforms()],
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
