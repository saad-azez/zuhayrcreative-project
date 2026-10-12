import { MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, type Material } from 'three'

// One material object for every mesh that asks for the same constant look.
//
// Written as JSX, `<meshStandardMaterial color="#0d0d0d" … />` makes a NEW material for each mesh it sits in, and the
// renderer treats each as a different one: every draw call re-sends the whole material (and it is drawn twice a frame, once
// for the window and once for the mirror). The lamp heads, their stems and brackets alone were thirty copies of one black
// metal. Meshes that share the object are drawn back to back with the material sent once. The picture is the same: only
// looks whose values are constants are asked for here, never one that a frame or an interaction changes.
const KINDS = { basic: MeshBasicMaterial, standard: MeshStandardMaterial, physical: MeshPhysicalMaterial } as const
type Kind = keyof typeof KINDS
type Value = string | number | boolean
const cache = new Map<string, Material>()

/** The shared material for `kind` with exactly these constant parameters. Use it as `<primitive object={…} attach="material" />`. */
export function sharedMaterial(kind: Kind, params: Readonly<Record<string, Value>>): Material {
  const key = kind + JSON.stringify(Object.entries(params).sort(([a], [b]) => (a < b ? -1 : 1)))
  let m = cache.get(key)
  if (!m) {
    m = new KINDS[kind](params)
    cache.set(key, m)
  }
  return m
}
