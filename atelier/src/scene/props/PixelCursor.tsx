import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, Matrix4, MeshBasicMaterial, MeshPhysicalMaterial, Vector3, type Group, type InstancedMesh, type Mesh } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { LOOP, TL } from '../../layout'
import { loopT } from '../../lib/time'
import { PAINT_MATERIALS } from '../pixels/paintMaterials'

// A giant mouse pointer built from pixels hovers beside the Z, pointing at it, the digital hand in the window. It clicks
// when the render lands (the scan finishes) and again when the undo begins; each click sends a crimson ring out from its tip.
// (17 Oct, the user: it no longer follows the real cursor; it stays here by the Z.)

const ARROW = [
  'X', 'XX', 'XoX', 'XooX', 'XoooX', 'XooooX', 'XoooooX', 'XooooooX', 'XoooooooX', 'XooooooooX', 'XoooooXXXXX',
  'XooXooX', 'XoX.XooX', 'XX..XooX', 'X....XooX', '.....XooX', '......XX',
]
const CELL = 0.024
/** The arrow's tip in the world; the arrow hangs down and right from it, facing the street (turned a touch toward the Z). */
const TIP = new Vector3(0.42, 0.8, -0.3)
const YAW = -0.22
const CLICKS = [TL.render[1] + 0.05, TL.unscan[0] - 0.05]
const CLICK_DUR = 0.42
const RING_DUR = 0.9

function cells(ch: string) {
  const out: [number, number][] = []
  ARROW.forEach((row, r) => [...row].forEach((c, k) => { if (c === ch) out.push([k, r]) }))
  return out
}

/** Seconds since the most recent click (looping), or Infinity. */
function sinceClick(t: number): number {
  let best = Infinity
  for (const c of CLICKS) {
    let d = t - c
    if (d < 0) d += LOOP
    best = Math.min(best, d)
  }
  return best
}

export function PixelCursor() {
  const root = useRef<Group>(null)
  const press = useRef<Group>(null)
  const ring = useRef<Mesh>(null)
  const outline = useRef<InstancedMesh>(null)
  const fill = useRef<InstancedMesh>(null)
  const geo = useMemo(() => new RoundedBoxGeometry(CELL * 0.94, CELL * 0.94, CELL * 0.94, 2, 0.003), [])
  const black = useMemo(() => new MeshPhysicalMaterial({ color: '#0b0b0c', roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.05 }), [])
  const ringMat = useMemo(
    () => new MeshBasicMaterial({ color: new Color(2.4, 0.05, 0.1), transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false }),
    [],
  )
  const xs = useMemo(() => cells('X'), [])
  const os = useMemo(() => cells('o'), [])

  useLayoutEffect(() => {
    const m = new Matrix4()
    const put = (mesh: InstancedMesh | null, list: [number, number][]) => {
      if (!mesh) return
      list.forEach(([k, r], i) => mesh.setMatrixAt(i, m.makeTranslation((k + 0.5) * CELL, -(r + 0.5) * CELL, 0)))
      mesh.instanceMatrix.needsUpdate = true
    }
    put(outline.current, xs)
    put(fill.current, os)
  }, [xs, os])

  useFrame(({ clock }) => {
    const t = loopT(clock.elapsedTime)
    const w = (2 * Math.PI * t) / LOOP
    if (root.current) {
      // A slow hover with its own rhythm (whole-loop harmonics, so the loop stays seamless).
      root.current.position.set(TIP.x + 0.012 * Math.sin(2 * w + 0.7), TIP.y + 0.018 * Math.sin(3 * w + 1.9), TIP.z)
      root.current.rotation.set(0.04 * Math.sin(w + 0.3), YAW + 0.05 * Math.sin(2 * w + 2.2), 0.03 * Math.sin(3 * w))
    }
    const d = sinceClick(t)
    const p = d < CLICK_DUR ? Math.sin((Math.PI * d) / CLICK_DUR) : 0
    if (press.current) {
      press.current.scale.setScalar(1 - 0.1 * p)
      press.current.position.z = -0.035 * p
    }
    if (ring.current) {
      const u = d / RING_DUR
      ring.current.visible = u < 1
      if (u < 1) {
        ring.current.scale.setScalar(0.25 + 2.6 * u)
        ringMat.opacity = (1 - u) * (1 - u)
      }
    }
  })

  return (
    <group ref={root}>
      <group ref={press}>
        <instancedMesh ref={outline} args={[geo, black, xs.length]} castShadow receiveShadow />
        <instancedMesh ref={fill} args={[geo, PAINT_MATERIALS.pearl, os.length]} castShadow receiveShadow />
      </group>
      <mesh ref={ring} material={ringMat} visible={false}>
        <torusGeometry args={[0.05, 0.0035, 12, 64]} />
      </mesh>
    </group>
  )
}
