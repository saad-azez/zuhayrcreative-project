import { MeshPhysicalMaterial } from 'three'
import type { PaintId } from '../../layout'
import { LOOK } from '../../look'
import { addScanBand } from './scanBand'

// One material per paint, shared by the ropes, the voxels, the flying pixels and the settled pixels.
export const PAINT_MATERIALS = {} as Record<PaintId, MeshPhysicalMaterial>
for (const p of Object.keys(LOOK.paints) as PaintId[]) {
  const L = LOOK.paints[p]
  const mat = new MeshPhysicalMaterial({
    color: L.color,
    metalness: L.metalness,
    roughness: L.roughness,
    clearcoat: L.clearcoat,
    clearcoatRoughness: L.clearcoatRoughness,
    iridescence: L.iridescence,
    iridescenceIOR: L.iridescenceIOR,
    iridescenceThicknessRange: [L.iridescenceThicknessRange[0], L.iridescenceThicknessRange[1]],
    envMapIntensity: L.envMapIntensity,
  })
  addScanBand(mat, p)
  PAINT_MATERIALS[p] = mat
}
