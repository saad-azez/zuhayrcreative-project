import { useMemo } from 'react'
import { MeshPhysicalMaterial } from 'three'
import { LOOK } from '../../look'
import { TUBE } from '../../layout'
import { buildCap } from './tubeGeometry'

// The unscrewed caps on the paper floor: one lying where it rolled, one left standing. (The two that lay at the front left,
// in front of the journal, are gone: they hid it (24 Oct, the user: "remove the object in front of the notebook").)
const CAPS: { p: [number, number, number]; yaw: number; lying: boolean }[] = [
  { p: [0.98, 0.061, -0.28], yaw: -0.7, lying: true },
  { p: [1.28, 0.0475, -0.52], yaw: 0, lying: false },
]

export function Caps() {
  const geometry = useMemo(() => buildCap(), [])
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: LOOK.blackPlastic.color,
        roughness: LOOK.blackPlastic.roughness,
        clearcoat: LOOK.blackPlastic.clearcoat,
        clearcoatRoughness: LOOK.blackPlastic.clearcoatRoughness,
      }),
    [],
  )
  return (
    <>
      {CAPS.map((c, i) => (
        <group key={i} position={c.p} rotation-y={c.yaw}>
          <mesh geometry={geometry} material={material} scale={TUBE.k} rotation-z={c.lying ? Math.PI / 2 : 0} castShadow receiveShadow />
        </group>
      ))}
    </>
  )
}
