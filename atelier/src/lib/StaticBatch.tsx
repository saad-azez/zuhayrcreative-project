import { useLayoutEffect, useRef, type ReactNode } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Material,
  Matrix4,
  Mesh,
  Object3D,
  type Texture,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Draws a static part of the window in far fewer draw calls, with the same pixels.
 *
 * The window was limited by its draw calls, not by its pixels or its effects: about 3,450 a frame, because every mesh is drawn
 * in the main view, in the floor's reflection, twice in the mirror, in up to three shadow maps, and again in the glass's
 * transmission pre-pass in each of those views. In Chrome each WebGL draw call has a fixed cost; at that count it held the
 * window near 15 fps on an M2 Pro whatever the resolution.
 *
 * Wrap a part of the scene that never moves. Once it has mounted, its solid meshes that share a material (the same object, or
 * one with identical settings and textures) are merged, in this group's space, into one mesh per material, and the originals
 * are hidden. They stay in place for pointer events (a raycast does not skip hidden meshes), so clicks land exactly as before.
 *
 * Left as they are, because merging them could change the picture: transparent meshes (they are depth-sorted one by one),
 * glass (transmission), instanced and skinned meshes, morph targets, multi-material meshes, meshes with their own
 * onBeforeRender, and anything already hidden. Merging changes nothing a shader can see: every vertex lands where it was, with
 * its normal and tangent turned the same way (world-space UVs come out the same).
 */
export function StaticBatch({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const made = batch(root)
    return () => {
      for (const m of made.merged) {
        m.removeFromParent()
        m.geometry.dispose()
      }
      for (const o of made.hidden) o.visible = true
    }
  }, [])
  return <group ref={ref}>{children}</group>
}

const NOOP = Object3D.prototype.onBeforeRender

function chainVisible(o: Object3D, root: Object3D): boolean {
  for (let p: Object3D | null = o; p && p !== root; p = p.parent) if (!p.visible) return false
  return true
}

/** A material's identity for merging: the object itself, or its settings when they are all plain values and textures. */
const matKeys = new WeakMap<Material, string>()
let matSeq = 0
function materialKey(m: Material): string {
  const hit = matKeys.get(m)
  if (hit) return hit
  let key: string
  // A material changed at compile time, or with its own program key, is only ever equal to itself.
  if (m.onBeforeCompile !== Material.prototype.onBeforeCompile || m.customProgramCacheKey !== Material.prototype.customProgramCacheKey) {
    key = 'own:' + ++matSeq
  } else {
    const parts: string[] = [m.type]
    for (const k of Object.keys(m).sort()) {
      if (k === 'uuid' || k === 'name' || k === 'id' || k === 'version' || k === 'userData' || k.startsWith('_')) continue
      const v = (m as unknown as Record<string, unknown>)[k]
      if (v === null || v === undefined) parts.push(k + '=-')
      else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') parts.push(k + '=' + v)
      else if ((v as Texture).isTexture) parts.push(k + '=t' + (v as Texture).uuid)
      else if (typeof (v as { getHexString?: () => string }).getHexString === 'function') parts.push(k + '=c' + (v as { getHexString: () => string }).getHexString())
      else if (typeof (v as { toArray?: () => number[] }).toArray === 'function') parts.push(k + '=v' + (v as { toArray: () => number[] }).toArray().join(','))
      else if (typeof v === 'function') continue
      else {
        // Anything else (plane arrays, defines objects, ...): only equal to itself.
        key = 'own:' + ++matSeq
        matKeys.set(m, key)
        return key
      }
    }
    key = parts.join(';')
  }
  matKeys.set(m, key)
  return key
}

/** A copy of the geometry with every attribute as plain float32 (quantized glTF attributes decoded), ready to merge. */
function plain(g: BufferGeometry): BufferGeometry {
  const out = new BufferGeometry()
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name]
    const n = a.count, s = a.itemSize
    const arr = new Float32Array(n * s)
    for (let i = 0; i < n; i++) {
      arr[i * s] = a.getX(i)
      if (s > 1) arr[i * s + 1] = a.getY(i)
      if (s > 2) arr[i * s + 2] = a.getZ(i)
      if (s > 3) arr[i * s + 3] = a.getW(i)
    }
    out.setAttribute(name, new BufferAttribute(arr, s))
  }
  if (g.index) out.setIndex(new BufferAttribute(Uint32Array.from(g.index.array as ArrayLike<number>), 1))
  return out
}

function flipWinding(g: BufferGeometry) {
  if (g.index) {
    const a = g.index.array as Uint32Array
    for (let i = 0; i + 2 < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t }
    return
  }
  for (const name of Object.keys(g.attributes)) {
    const at = g.attributes[name], s = at.itemSize, arr = at.array as Float32Array
    for (let v = 0; v + 2 < at.count; v += 3) for (let k = 0; k < s; k++) { const t = arr[(v + 1) * s + k]; arr[(v + 1) * s + k] = arr[(v + 2) * s + k]; arr[(v + 2) * s + k] = t }
  }
}

function batch(root: Group): { merged: Mesh[]; hidden: Mesh[] } {
  root.updateWorldMatrix(true, true)
  const toRoot = new Matrix4().copy(root.matrixWorld).invert()
  const buckets = new Map<string, Mesh[]>()
  root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh || (m as unknown as { isInstancedMesh?: boolean }).isInstancedMesh || (m as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) return
    if (!chainVisible(m, root) || Array.isArray(m.material) || m.onBeforeRender !== NOOP) return
    const mat = m.material as Material & { transmission?: number }
    if (mat.transparent || (mat.transmission ?? 0) > 0) return
    const g = m.geometry
    if (Object.keys(g.morphAttributes).length || g.groups.length > 1) return
    const attrs = Object.keys(g.attributes).sort().map((k) => k + g.attributes[k].itemSize).join(',')
    const key = [
      materialKey(mat), attrs, g.index ? 'i' : 'n', m.castShadow, m.receiveShadow, m.renderOrder, m.layers.mask, m.frustumCulled,
      m.customDepthMaterial?.uuid ?? '', m.customDistanceMaterial?.uuid ?? '',
    ].join('|')
    const list = buckets.get(key)
    if (list) list.push(m)
    else buckets.set(key, [m])
  })

  const merged: Mesh[] = []
  const hidden: Mesh[] = []
  const tmp = new Matrix4()
  for (const list of buckets.values()) {
    if (list.length < 2) continue
    const geos = list.map((m) => {
      const g = plain(m.geometry)
      tmp.multiplyMatrices(toRoot, m.matrixWorld)
      g.applyMatrix4(tmp)
      // A mirrored mesh (negative scale) has its faces wound the other way, which three makes up for per object when it
      // draws it; baked in, the triangles are turned back round so the merged mesh culls the same faces.
      if (tmp.determinant() < 0) flipWinding(g)
      return g
    })
    const geo = mergeGeometries(geos, false)
    geos.forEach((g) => g.dispose())
    if (!geo) continue
    geo.computeBoundingBox()
    geo.computeBoundingSphere()
    const first = list[0]
    const mesh = new Mesh(geo, first.material)
    mesh.name = 'StaticBatch'
    mesh.castShadow = first.castShadow
    mesh.receiveShadow = first.receiveShadow
    mesh.renderOrder = first.renderOrder
    mesh.layers.mask = first.layers.mask
    mesh.frustumCulled = first.frustumCulled
    mesh.customDepthMaterial = first.customDepthMaterial
    mesh.customDistanceMaterial = first.customDistanceMaterial
    mesh.raycast = () => {} // the hidden originals keep answering pointer events
    root.add(mesh)
    merged.push(mesh)
    for (const m of list) {
      m.visible = false
      hidden.push(m)
    }
  }
  return { merged, hidden }
}
