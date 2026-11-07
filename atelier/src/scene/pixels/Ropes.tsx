import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Vector3, type Mesh } from 'three'
import { TUBES } from '../../layout'
import { loopT } from '../../lib/time'
import { PAINT_MATERIALS } from './paintMaterials'
import { ROPE_R, ropeLength, streamPoint, streamTangent } from './streams'
import { squeeze } from '../tubes/motion'

const NR = 40
const NA = 32
const COLS = NA + 1

const C = new Vector3()
const Tg = new Vector3()
const N = new Vector3()
const Bn = new Vector3()
const Z = new Vector3(0, 0, 1)

/** A ring-by-ring tube surface; the vertices are rewritten every frame. Quads wound so the faces look outward. */
function makeRopeGeometry(): BufferGeometry {
  const g = new BufferGeometry()
  const pos = new BufferAttribute(new Float32Array(NR * COLS * 3), 3)
  pos.setUsage(DynamicDrawUsage)
  g.setAttribute('position', pos)
  const idx: number[] = []
  for (let i = 0; i < NR - 1; i++) {
    for (let q = 0; q < NA; q++) {
      const a = i * COLS + q, b = a + 1, c = a + COLS, d = c + 1
      idx.push(a, b, c, b, d, c)
    }
  }
  g.setIndex(idx)
  return g
}

// The glossy paint rope that comes out of each nozzle while it pours, following the stream's bending centreline.
export function Ropes() {
  const geos = useMemo(() => TUBES.map(() => makeRopeGeometry()), [])
  const refs = useRef<(Mesh | null)[]>([])

  useFrame(({ clock }) => {
    const t = loopT(clock.elapsedTime)
    for (const T of TUBES) {
      const mesh = refs.current[T.index]
      if (!mesh) continue
      const L = ropeLength(T, t)
      if (L < 0.002) { mesh.visible = false; continue }
      mesh.visible = true
      const geo = geos[T.index]
      const arr = (geo.getAttribute('position') as BufferAttribute).array as Float32Array
      // A squeeze pushes a fatter rope out of the nozzle.
      const swell = 1 + 0.22 * squeeze(T, t)
      for (let i = 0; i < NR; i++) {
        const s = (L * i) / (NR - 1)
        streamPoint(T, s, t, C)
        streamTangent(T, s, Tg)
        N.crossVectors(Tg, Z).normalize()
        Bn.crossVectors(Tg, N)
        const cap = i === NR - 1 ? 0 : s > L - ROPE_R ? Math.sqrt(Math.max(0, 1 - ((s - (L - ROPE_R)) / ROPE_R) ** 2)) : 1
        for (let q = 0; q <= NA; q++) {
          const phi = (2 * Math.PI * q) / NA
          const r = ROPE_R * swell * cap * (1 + 0.07 * Math.cos(6 * phi + 40 * s - 10 * t))
          const cp = Math.cos(phi) * r, sp = Math.sin(phi) * r
          const o = (i * COLS + q) * 3
          arr[o] = C.x + N.x * cp + Bn.x * sp
          arr[o + 1] = C.y + N.y * cp + Bn.y * sp
          arr[o + 2] = C.z + N.z * cp + Bn.z * sp
        }
      }
      geo.computeVertexNormals()
      ;(geo.getAttribute('position') as BufferAttribute).needsUpdate = true
      ;(geo.getAttribute('normal') as BufferAttribute).needsUpdate = true
      geo.computeBoundingSphere()
    }
  })

  return (
    <group>
      {TUBES.map((T) => (
        <mesh
          key={T.id}
          ref={(el) => { refs.current[T.index] = el }}
          geometry={geos[T.index]}
          material={PAINT_MATERIALS[T.paint]}
          castShadow
          frustumCulled={false}
          visible={false}
        />
      ))}
    </group>
  )
}
