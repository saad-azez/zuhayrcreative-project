import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

/** Counts animation frames (incremented first thing each frame); MirrorWall keys its once-per-frame render on it. */
export let renderFrame = 0

/**
 * Renders the shadow maps once per frame instead of once per renderer.render call (the floor reflector, the mirror, the
 * main pass and N8AO each call it). The maps only depend on the lights and the casters, which do not change within a frame,
 * so the pixels are identical. Mount inside <Canvas>, before the scene.
 */
export function RenderBudget() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const prev = gl.shadowMap.autoUpdate
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    return () => { gl.shadowMap.autoUpdate = prev }
  }, [gl])
  // Negative priority: runs before every other frame callback (the floor reflector renders in a priority-0 useFrame)
  // and does NOT take over R3F's render loop (only positive priorities do).
  useFrame(() => {
    renderFrame++
    gl.shadowMap.needsUpdate = true // three clears this after the first render of the frame has drawn the maps
  }, -1)
  return null
}
