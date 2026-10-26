import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, DoubleSide, Vector3, type Group, type Mesh } from 'three'
import { ambientT } from '../../lib/time'
import { PAINT_MATERIALS } from '../pixels/paintMaterials'
import { BRUSH_LEN, Brush, useBrushKit, type BrushSpec } from './Brush'

// A brush with a mind of its own (11 Oct, the user: at least one brush animated, hovering / painting / quirky). It hovers in the
// back left, bobbing and idly turning, then swoops down to the paper floor, drags a glossy crimson stroke, flicks itself
// off with a twirl and floats back up; the stroke dries away while it hovers. Every cycle paints a different stroke.
// Free-running (ambient) time, so a capture / reduced motion shows it simply hovering.

const SPEC: BrushSpec[] = [{ head: 'round', hair: 'synthetic', lacquer: 'crimson', wet: '#c4010d', label: 'ZUHAYR CREATIVE · ROUND No. 10' }]
const SCALE = 0.5 // a 0.62 m brush, a touch bigger than the tin's
const CYCLE = 7.4
const HOVER = new Vector3(-1.1, 1.08, -1.05)
const SEG = 64
const WIDTH = 0.034

/** Four stroke shapes (x, z on the floor) the brush cycles through: an S, a swoosh, a tick and a loop-de-loop. */
const STROKES: [number, number][][] = [
  [[-1.42, -1.38], [-1.3, -1.28], [-1.16, -1.34], [-1.02, -1.24], [-0.9, -1.3]],
  [[-1.4, -1.22], [-1.26, -1.34], [-1.08, -1.38], [-0.94, -1.33], [-0.86, -1.2]],
  [[-1.36, -1.36], [-1.28, -1.25], [-1.2, -1.32], [-1.04, -1.42], [-0.88, -1.46]],
  [[-1.4, -1.3], [-1.24, -1.36], [-1.14, -1.24], [-1.24, -1.18], [-1.1, -1.3], [-0.9, -1.34]],
]
const curves = STROKES.map((pts) => new CatmullRomCurve3(pts.map(([x, z]) => new Vector3(x, 0.0035, z)), false, 'centripetal'))

const ss = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c) }
const V = new Vector3()
const T = new Vector3()
const P = new Vector3()

export function FlyingBrush() {
  const kit = useBrushKit(SPEC)
  const root = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const stroke = useRef<Mesh>(null)
  const wet = useMemo(() => { const m = PAINT_MATERIALS.crimson.clone(); m.side = DoubleSide; return m }, [])
  const geo = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3))
    g.setAttribute('normal', new BufferAttribute(new Float32Array((SEG + 1) * 2 * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
    const idx: number[] = []
    for (let i = 0; i < SEG; i++) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3)
    g.setIndex(idx)
    return g
  }, [])

  useFrame(({ clock }) => {
    const e = ambientT(clock.elapsedTime)
    const cyc = Math.floor(e / CYCLE)
    const c = e - cyc * CYCLE
    const curve = curves[((cyc % curves.length) + curves.length) % curves.length]
    // Phases: hover 0-2.4, swoop 2.4-3.1, paint 3.1-4.5, flick 4.5-5.1, return 5.1-6.2, hover.
    const paint = ss((c - 3.1) / 1.4)
    curve.getPointAt(Math.min(paint, 1), P)
    const bob = 0.035 * Math.sin(e * 1.7) + 0.012 * Math.sin(e * 3.1 + 1)
    const hover = V.set(HOVER.x + 0.03 * Math.sin(e * 0.9), HOVER.y + bob, HOVER.z + 0.02 * Math.sin(e * 1.3 + 2))
    const down = ss((c - 2.4) / 0.7) * (1 - ss((c - 4.5) / 0.6))
    const back = c < 4.5 ? 0 : ss((c - 5.1) / 1.1)
    // While painting the tip rides the stroke; on the way down/up it arcs between the hover point and the floor.
    const target = T.copy(P)
    target.y += 0.004
    const g = root.current
    if (g) {
      if (c < 4.5) g.position.lerpVectors(hover, target, down)
      else {
        // Flick up off the floor with a little hop, then drift home.
        const flick = ss((c - 4.5) / 0.6)
        T.y += 0.35 * flick
        g.position.lerpVectors(T, hover, back)
      }
      // Lean: upright-ish while hovering, laid over into the stroke while painting, the handle trailing the direction of travel.
      const lean = 0.35 + 0.6 * down
      g.rotation.set(-lean * 0.6, 0.6 + 0.4 * Math.sin(e * 0.5) + 1.2 * paint, lean * 0.8 + 0.08 * Math.sin(e * 2.3))
    }
    // The twirl after each stroke, about the brush's own axis; a slow idle turn otherwise.
    if (spin.current) spin.current.rotation.y = 0.4 * e + Math.PI * 2 * ss((c - 4.55) / 0.55)

    // The stroke grows behind the tip, then dries away (thinning to nothing) from 6.4 s until the next stroke starts.
    const m = stroke.current
    if (m) {
      const dry = c > 3.0 ? ss((c - 6.0) / 1.2) : 1
      const shown = c < 3.1 ? 0 : paint
      m.visible = shown > 0.001 && dry < 0.999
      if (m.visible) {
        const pos = geo.getAttribute('position') as BufferAttribute
        for (let i = 0; i <= SEG; i++) {
          const u = (i / SEG) * shown
          curve.getPointAt(u, P)
          curve.getTangentAt(u, V)
          // A brush stroke: swells after the touch-down and tapers off at the lift, with a dry-brush wobble.
          const prof = Math.sin(Math.PI * Math.min(1, (i / SEG) * 0.95 + 0.05)) ** 0.6
          const w = WIDTH * (0.35 + 0.65 * prof) * (1 + 0.08 * Math.sin(i * 1.7 + cyc)) * (1 - dry)
          const nx = -V.z, nz = V.x
          pos.setXYZ(2 * i, P.x + nx * w * 0.5, P.y, P.z + nz * w * 0.5)
          pos.setXYZ(2 * i + 1, P.x - nx * w * 0.5, P.y, P.z - nz * w * 0.5)
        }
        pos.needsUpdate = true
        geo.computeBoundingSphere()
      }
    }
  })

  return (
    <>
      <group ref={root} position={HOVER}>
        <group ref={spin}>
          {/* The brush's origin is its tip, running up +y: the tip leads. */}
          <group scale={SCALE}>
            <Brush kit={kit} spec={SPEC[0]} />
          </group>
        </group>
      </group>
      <mesh ref={stroke} geometry={geo} material={wet} receiveShadow visible={false} frustumCulled={false} />
    </>
  )
}

export const FLYING_BRUSH_LEN = BRUSH_LEN * SCALE
