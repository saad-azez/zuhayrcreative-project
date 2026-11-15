import { useMemo, type ReactNode } from 'react'
import { Text } from '@react-three/drei'
import { LatheGeometry, MeshPhysicalMaterial, Quaternion, Vector2, Vector3 } from 'three'
import { a } from '../../lib/assets'
import { BRUSH_LEN, Brush, useBrushKit, type BrushSpec } from './Brush'
import { PENCIL, Pencil, usePencilKit, type PencilKit, type PencilLacquer } from './Pencil'

// Back right on the paper: a crimson enamel tin of brushes and pencils, bristles up, still wet with the four paints; and one
// pencil left lying across the front of the paper. Desk-prop scale 2.2x.

const S = 2.2
/** scale: the tin and its contents shown a size up from the desk props (3.1x life) so they read from the street. */
export const JAR = { x: 1.66, z: -1.1, R: 0.04 * S, H: 0.115 * S, scale: 1.4 } as const
const BRUSH_SCALE = 0.42 // 1.25 m brush -> 0.525 m (a 24 cm brush at 2.2x)
// Crowded like a working studio's tin (11 Oct, the user: real brushes, and more pencils in the holder): five brushes of
// different heads, hairs and lacquers, and five pencils in the brand lacquers.
type Item = { kind: 'brush' | 'pencil'; theta: number; lean: number; off: number; brush?: BrushSpec; lacquer?: PencilLacquer; spin: number }
const ITEMS: Item[] = [
  { kind: 'brush', theta: 0.35, lean: 0.17, off: 0.032, spin: 0.4, brush: { head: 'round', hair: 'synthetic', lacquer: 'black', wet: '#c4010d', label: 'ZUHAYR CREATIVE · ROUND No. 8' } },
  { kind: 'pencil', theta: 0.95, lean: 0.12, off: 0.03, spin: 0, lacquer: 'black' },
  { kind: 'brush', theta: 1.6, lean: 0.21, off: 0.036, spin: 2.1, brush: { head: 'flat', hair: 'hog', lacquer: 'crimson', wet: '#5a0614', label: 'ZUHAYR CREATIVE · FLAT No. 12' } },
  { kind: 'pencil', theta: 2.25, lean: 0.19, off: 0.04, spin: 2.4, lacquer: 'crimson' },
  { kind: 'brush', theta: 2.9, lean: 0.13, off: 0.028, spin: 4.0, brush: { head: 'round', hair: 'sable', lacquer: 'ash', label: 'ZUHAYR CREATIVE · KOLINSKY No. 6' } },
  { kind: 'pencil', theta: 3.5, lean: 0.24, off: 0.042, spin: 0.9, lacquer: 'pearl' },
  { kind: 'brush', theta: 4.1, lean: 0.16, off: 0.034, spin: 1.3, brush: { head: 'liner', hair: 'synthetic', lacquer: 'pearl', wet: '#c4010d', label: 'ZUHAYR CREATIVE · LINER No. 2' } },
  { kind: 'pencil', theta: 4.7, lean: 0.15, off: 0.033, spin: 1.0, lacquer: 'chrome' },
  { kind: 'brush', theta: 5.3, lean: 0.23, off: 0.036, spin: 5.2, brush: { head: 'flat', hair: 'synthetic', lacquer: 'black', wet: '#f1ebdf', label: 'ZUHAYR CREATIVE · FLAT No. 20' } },
  { kind: 'pencil', theta: 5.85, lean: 0.2, off: 0.038, spin: 3.3, lacquer: 'black' },
]
const SPECS: BrushSpec[] = ITEMS.flatMap((it) => (it.brush ? [it.brush] : []))

function useTin() {
  return useMemo(() => {
    const { R, H } = JAR
    const pts: [number, number][] = [
      [0.0001, 0.003], [R * 0.86, 0.003], [R - 0.003, 0.0005], [R, 0.005], [R, H - 0.007], [R + 0.0032, H - 0.003],
      [R + 0.0026, H + 0.0016], [R - 0.0012, H + 0.002], [R - 0.0036, H - 0.004], [R - 0.0036, 0.014], [0.0001, 0.014],
    ]
    const geo = new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), 96)
    const enamel = new MeshPhysicalMaterial({ color: '#a8000d', roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.3 })
    return { geo, enamel }
  }, [])
}

const UP = new Vector3(0, 1, 0)

function Standing({ item, children, length }: { item: Item; children: ReactNode; length: number }) {
  const { pos, quat } = useMemo(() => {
    const d = new Vector3(Math.cos(item.theta), 0, Math.sin(item.theta))
    const axis = new Vector3().crossVectors(UP, d).normalize()
    const q = new Quaternion().setFromAxisAngle(axis, item.lean)
    return { pos: new Vector3(-d.x * item.off, 0.015, -d.z * item.off), quat: q }
  }, [item])
  // Flipped tip-up: the item's own origin (its tip) ends at the top, its far end on the tin's floor.
  return (
    <group position={pos} quaternion={quat}>
      <group rotation-y={item.spin}>
        <group position={[0, length, 0]} rotation-x={Math.PI}>
          {children}
        </group>
      </group>
    </group>
  )
}

export function BrushJar() {
  const tin = useTin()
  const brushes = useBrushKit(SPECS)
  const pencils = usePencilKit()
  return (
    <group position={[JAR.x, 0, JAR.z]} rotation-y={-0.5} scale={JAR.scale}>
      <mesh geometry={tin.geo} material={tin.enamel} castShadow receiveShadow />
      <Text
        font={a('fonts/Anton-Regular.ttf')}
        fontSize={0.03}
        letterSpacing={0.12}
        anchorX="center"
        anchorY="middle"
        position={[0, JAR.H * 0.56, JAR.R + 0.0006]}
        {...({ curveRadius: -(JAR.R + 0.0006) } as Record<string, unknown>)}
      >
        ZUHAYR CREATIVE
        <meshPhysicalMaterial metalness={1} color="#e6e8eb" roughness={0.2} envMapIntensity={2.4} />
      </Text>
      <Text
        font={a('fonts/GeistMono.ttf')}
        fontSize={0.0105}
        letterSpacing={0.3}
        anchorX="center"
        anchorY="middle"
        position={[0, JAR.H * 0.43, JAR.R + 0.0006]}
        {...({ curveRadius: -(JAR.R + 0.0006) } as Record<string, unknown>)}
      >
        BRUSHES · PENCILS · No. 07
        <meshPhysicalMaterial metalness={1} color="#e6e8eb" roughness={0.2} envMapIntensity={2.4} />
      </Text>
      {ITEMS.map((it, i) =>
        it.kind === 'brush' ? (
          <Standing key={i} item={it} length={BRUSH_LEN * BRUSH_SCALE}>
            <group scale={BRUSH_SCALE}>
              <Brush kit={brushes} spec={it.brush!} />
            </group>
          </Standing>
        ) : (
          <Standing key={i} item={it} length={PENCIL.len}>
            <Pencil kit={pencils} lacquer={it.lacquer} />
          </Standing>
        ),
      )}
    </group>
  )
}

/** A pencil left lying across the front of the paper, resting on a flat with its foil name up. */
export function LyingPencil({ kit }: { kit: PencilKit }) {
  return (
    <group position={[1.15, PENCIL.ri, -0.13]} rotation={[0, 0.42, 0]}>
      <group rotation-z={-Math.PI / 2} position={[-PENCIL.len / 2, 0, 0]}>
        <Pencil kit={kit} />
      </group>
    </group>
  )
}
