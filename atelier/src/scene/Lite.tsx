import { useEffect } from 'react'
import { useThree, type RootState } from '@react-three/fiber'
import type { Camera } from 'three'
import { EVERY, GLASS, LITE } from '../lib/lite'
import { renderFrame } from './RenderBudget'

/**
 * `?lite=` (lib/lite.ts): every render that is not the main view is a reflection (the mirror's and the floor's own cameras);
 * under `refl` each is let through every EVERY-th frame (`&every=`, default 2), each on its own frame of the cycle, and its
 * render target keeps last frame's picture in between. Under `glass` the glass loses its refraction for those renders only.
 */
export function Lite() {
  const gl = useThree((s) => s.gl)
  const get = useThree((s) => s.get) as () => RootState
  useEffect(() => {
    if (!LITE.has('refl') && !LITE.has('glass')) return
    const render = gl.render.bind(gl)
    const slot = new Map<Camera, number>()
    gl.render = (scene, camera) => {
      // Only the reflections' own perspective cameras (the mirror's and the floor's). The post-processing passes draw with
      // orthographic full-screen cameras, the last of them onto the screen: throttling those froze the whole picture between
      // redraws (1 Nov: the "fast" version updated the screen only every Nth frame).
      if (camera === get().camera || !(camera as { isPerspectiveCamera?: boolean }).isPerspectiveCamera) return render(scene, camera)
      if (LITE.has('refl')) {
        // Spread over the cycle so no frame redraws them all (EVERY = 2: alternate frames).
        if (!slot.has(camera)) slot.set(camera, slot.size % EVERY)
        if (renderFrame % EVERY !== slot.get(camera)) return
      }
      if (!LITE.has('glass')) return render(scene, camera)
      const was = [...GLASS].map((m) => m.transmission)
      for (const m of GLASS) m.transmission = 0
      try { render(scene, camera) } finally { [...GLASS].forEach((m, i) => (m.transmission = was[i])) }
    }
    return () => { gl.render = render }
  }, [gl, get])
  return null
}
