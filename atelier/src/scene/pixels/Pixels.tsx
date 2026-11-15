import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three'
import { TUBES } from '../../layout'
import { loopT } from '../../lib/time'
import { PAINT_MATERIALS } from './paintMaterials'
import { scanY, slotPose } from './schedule'
import { scanUniforms } from './scanBand'
import { rasterCells } from './streams'
import { VOXEL_GEO } from './voxelGeometry'
import { SLOTS_BY_TUBE } from './voxelZ'

const pos = new Vector3()
const quat = new Quaternion()
const scale = new Vector3()
const m = new Matrix4()
const buf: number[] = []

// The Z's pixels: one instanced mesh per paint. Each frame every slot is posed from the loop time alone, then the
// stream's raster cells (the paint taking shape in mid-air) are appended after them.
export function Pixels() {
  const refs = useRef<(InstancedMesh | null)[]>([])

  useFrame(({ clock }) => {
    const t = loopT(clock.elapsedTime)
    scanUniforms.uScanY.value = scanY(t)
    for (const T of TUBES) {
      const mesh = refs.current[T.index]
      if (!mesh) continue
      let n = 0
      for (const slot of SLOTS_BY_TUBE[T.index]) {
        const s = slotPose(slot, t, pos, quat)
        if (s > 0) {
          m.compose(pos, quat, scale.setScalar(s))
          mesh.setMatrixAt(n++, m)
        }
      }
      const count = rasterCells(T, t, buf)
      for (let q = 0; q < count; q++) {
        m.makeTranslation(buf[q * 3], buf[q * 3 + 1], buf[q * 3 + 2])
        mesh.setMatrixAt(n++, m)
      }
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      {TUBES.map((T) => (
        <instancedMesh
          key={T.id}
          ref={(el) => { refs.current[T.index] = el }}
          args={[VOXEL_GEO, PAINT_MATERIALS[T.paint], SLOTS_BY_TUBE[T.index].length + 64]}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </group>
  )
}
