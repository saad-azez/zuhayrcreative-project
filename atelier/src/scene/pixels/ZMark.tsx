import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, MeshPhysicalMaterial, Plane, Vector3, type Group } from 'three'
import { ZMARK, zYaw } from '../../layout'
import { LOOK } from '../../look'
import { loopT } from '../../lib/time'
import mark from '../../../data/z-mark.json'
import { SCAN_M, scanY } from './schedule'
import { addScanBand } from './scanBand'
import { ZMARK_BOTTOM } from './voxelZ'

const verts = mark.vertices as unknown as Record<string, [number, number, number]>

/** One half as a solid: its front facets, the back pushed by thickness (reversed), and a wall around the outline. */
function buildHalf(tris: string[][], outline: string[], thickness: number): BufferGeometry {
  const p = (k: string) => verts[k] as [number, number, number]
  const back = (v: [number, number, number]): [number, number, number] => [v[0], v[1], v[2] - thickness]
  const out: number[] = []
  const push = (...vs: [number, number, number][]) => { for (const v of vs) out.push(v[0], v[1], v[2]) }
  for (const [a, b, c] of tris) { push(p(a), p(b), p(c)); push(back(p(a)), back(p(c)), back(p(b))) }
  for (let i = 0; i < outline.length; i++) {
    const P = p(outline[i]), Q = p(outline[(i + 1) % outline.length])
    push(P, Q, back(Q)); push(P, back(Q), back(P))
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(out, 3))
  g.computeVertexNormals()
  return g
}

// The true mark the scan "renders": the two chrome / crimson halves, clipped to the part the scan line has already passed.
// (The renderer's localClippingEnabled is switched on by the canvas.)
export function ZMark() {
  const group = useRef<Group>(null)
  const plane = useMemo(() => new Plane(new Vector3(0, -1, 0), -10), [])

  const kit = useMemo(() => {
    const thickness = ZMARK.thickness / ZMARK.scale
    const top = new MeshPhysicalMaterial({
      side: DoubleSide, flatShading: true, metalness: 1, color: LOOK.chrome.color, roughness: LOOK.chrome.roughness,
      envMapIntensity: LOOK.chrome.envMapIntensity, clippingPlanes: [plane], clipShadows: true,
    })
    const bottom = new MeshPhysicalMaterial({
      side: DoubleSide, flatShading: true, metalness: 1, color: LOOK.crimsonMetal.color, roughness: LOOK.crimsonMetal.roughness,
      clearcoat: LOOK.crimsonMetal.clearcoat, clearcoatRoughness: LOOK.crimsonMetal.clearcoatRoughness,
      envMapIntensity: LOOK.crimsonMetal.envMapIntensity, clippingPlanes: [plane], clipShadows: true,
    })
    addScanBand(top, 'zTop')
    addScanBand(bottom, 'zBottom')
    return {
      top,
      bottom,
      topGeo: buildHalf(mark.halves.top.frontTriangles, mark.halves.top.outline, thickness),
      bottomGeo: buildHalf(mark.halves.bottom.frontTriangles, mark.halves.bottom.outline, thickness),
    }
  }, [plane])

  useFrame(({ clock }) => {
    const t = loopT(clock.elapsedTime)
    const y = scanY(t)
    plane.constant = y
    const g = group.current
    if (!g) return
    g.visible = y > ZMARK_BOTTOM - SCAN_M + 1e-4
    g.rotation.y = zYaw(t)
  })

  return (
    <group ref={group} position={ZMARK.pos} scale={ZMARK.scale} visible={false}>
      <mesh geometry={kit.topGeo} material={kit.top} castShadow receiveShadow />
      <mesh geometry={kit.bottomGeo} material={kit.bottom} castShadow receiveShadow />
    </group>
  )
}
