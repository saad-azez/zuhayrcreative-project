import { BufferAttribute, type BufferGeometry } from 'three'

/**
 * Box-projects a metric UV set onto a geometry that is already at its final size, so a texture tile
 * always covers `metresPerTile` metres whatever the surface's size. Each vertex is projected along
 * the axis its normal points most strongly down.
 */
export function worldBoxUV(geo: BufferGeometry, metresPerTile: number, offset: [number, number] = [0, 0]): BufferGeometry {
  if (!geo.getAttribute('normal')) geo.computeVertexNormals()
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i)
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i))
    let u: number, v: number
    if (ax >= ay && ax >= az) { u = pz; v = py }
    else if (ay >= ax && ay >= az) { u = px; v = pz }
    else { u = px; v = py }
    uv[i * 2] = u / metresPerTile + offset[0]
    uv[i * 2 + 1] = v / metresPerTile + offset[1]
  }
  geo.setAttribute('uv', new BufferAttribute(uv, 2))
  return geo
}
