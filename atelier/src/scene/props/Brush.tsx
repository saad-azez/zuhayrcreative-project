import { useMemo } from 'react'
import { Text } from '@react-three/drei'
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  LatheGeometry,
  MeshPhysicalMaterial,
  SplineCurve,
  Vector2,
  type WebGLProgramParametersWithUniforms,
} from 'three'
import { LOOK } from '../../look'
import { a, usePBR } from '../../lib/assets'

// The Zuhayr Creative artist's brushes (11 Oct, the user: the old ones read as cigarettes: a fat cream-and-red cylinder). Now
// they are real brushes: a long, slim lacquered handle that swells behind the ferrule and tapers to a fine tail, a long crimped
// chrome ferrule, and a shaped head: a round with a belly and a fine point, or a flat with a square chisel edge, in real hair
// colours (charcoal synthetic, sable, white hog), with paint only on the very tips. Silver foil lettering runs along the handle.
// Local frame: origin = the bristle tip, +y up the brush to the handle end (BRUSH_LEN at scale 1). Shown at ~0.42 scale.

export const BRUSH_LEN = 1.25

export type HeadShape = 'round' | 'flat' | 'liner'
export type Hair = 'synthetic' | 'sable' | 'hog'
export type Lacquer = 'black' | 'crimson' | 'pearl' | 'ash'
export type BrushSpec = { head: HeadShape; hair: Hair; lacquer: Lacquer; wet?: string; label?: string }

/** Bristle length (from the ferrule mouth to the tip) per head shape. */
const HEAD_LEN: Record<HeadShape, number> = { round: 0.17, flat: 0.15, liner: 0.2 }
/** The flat head is squashed into a fan of hair: its x / z scale (and its ferrule's at the mouth). */
const FLAT = { x: 1.55, z: 0.36 } as const

function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The head's radius at u (0 at the ferrule mouth, 1 at the tip). */
function envelope(shape: HeadShape, u: number): number {
  const c = Math.min(1, Math.max(0, u))
  if (shape === 'flat') {
    // Nearly parallel sides with a slight belly and a square, chisel-cut end.
    const sq = c < 0.9 ? 1 : 1 - 0.3 * ((c - 0.9) / 0.1) ** 2
    return 0.026 * (1 + 0.1 * Math.sin(Math.PI * Math.min(c / 0.85, 1))) * sq + 0.0006
  }
  if (shape === 'liner') return 0.019 * Math.pow(1 - c, 0.55) * (1 + 0.12 * Math.sin(Math.PI * Math.min(c / 0.5, 1))) + 0.0005
  // Round: out of the ferrule, a belly a third of the way, then a long fine point.
  return 0.026 * Math.pow(1 - Math.pow(c, 1.6), 0.8) * (1 + 0.3 * Math.sin(Math.PI * Math.min(c / 0.75, 1))) + 0.0007
}

/** 900 hair strands (open 5-sided tubes) plus a solid core, merged into one indexed geometry. */
function buildBristles(shape: HeadShape): BufferGeometry {
  const BRISTLE_LEN = HEAD_LEN[shape]
  const rand = mulberry32(shape === 'round' ? 7 : shape === 'flat' ? 11 : 19)
  const STRANDS = 900, RINGS = 12, SIDES = 5
  const core: Vector2[] = []
  for (let i = 0; i <= 24; i++) {
    const u = (0.97 * i) / 24
    core.push(new Vector2(0.85 * envelope(shape, u), BRISTLE_LEN - u * BRISTLE_LEN))
  }
  const lathe = new LatheGeometry(core, 24)
  const coreCount = lathe.getAttribute('position').count
  const total = STRANDS * RINGS * SIDES + coreCount
  const pos = new Float32Array(total * 3)
  const nor = new Float32Array(total * 3)
  const aU = new Float32Array(total)
  const aSeed = new Float32Array(total)
  const idx: number[] = []
  let vi = 0
  for (let s = 0; s < STRANDS; s++) {
    const angle = rand() * Math.PI * 2
    const rootR = Math.sqrt(rand())
    const seed = rand()
    const Ls = BRISTLE_LEN * (1 - (shape === 'flat' ? 0.04 : 0.25) * rootR * rootR)
    const base = vi
    for (let j = 0; j < RINGS; j++) {
      const v = j / (RINGS - 1)
      const u = (v * Ls) / BRISTLE_LEN
      const y = BRISTLE_LEN - u * BRISTLE_LEN
      const R = envelope(shape, u)
      const wob = 0.0012 * Math.sin(v * 7 + seed * 20) * v
      const cx = Math.cos(angle) * rootR * R + Math.cos(angle + 1.7) * wob
      const cz = Math.sin(angle) * rootR * R + Math.sin(angle + 1.7) * wob
      const rs = 0.0011 + (0.00035 - 0.0011) * v
      for (let k = 0; k < SIDES; k++) {
        const phi = (k * Math.PI * 2) / SIDES
        const c = Math.cos(phi), sn = Math.sin(phi)
        pos[vi * 3] = cx + rs * c
        pos[vi * 3 + 1] = y
        pos[vi * 3 + 2] = cz + rs * sn
        nor[vi * 3] = c
        nor[vi * 3 + 2] = sn
        aU[vi] = u
        aSeed[vi] = seed
        vi++
      }
    }
    for (let j = 0; j < RINGS - 1; j++) {
      for (let k = 0; k < SIDES; k++) {
        const k1 = (k + 1) % SIDES
        const p = base + j * SIDES + k, q = base + j * SIDES + k1, r = base + (j + 1) * SIDES + k, t = base + (j + 1) * SIDES + k1
        idx.push(p, r, q, q, r, t)
      }
    }
  }
  const lp = lathe.getAttribute('position')
  const ln = lathe.getAttribute('normal')
  const coreBase = vi
  for (let i = 0; i < coreCount; i++) {
    pos.set([lp.getX(i), lp.getY(i), lp.getZ(i)], vi * 3)
    nor.set([ln.getX(i), ln.getY(i), ln.getZ(i)], vi * 3)
    aU[vi] = 1 - lp.getY(i) / BRISTLE_LEN
    aSeed[vi] = 0.5
    vi++
  }
  const li = lathe.getIndex()!
  for (let i = 0; i < li.count; i++) idx.push(coreBase + li.getX(i))
  lathe.dispose()
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('aU', new Float32BufferAttribute(aU, 1))
  g.setAttribute('aSeed', new Float32BufferAttribute(aSeed, 1))
  g.setIndex(idx)
  // Every head's mouth sits at the ferrule (y = 0.17) whatever its length.
  g.translate(0, 0.17 - BRISTLE_LEN, 0)
  g.computeBoundingSphere()
  return g
}

/** Hair colours: [at the ferrule, toward the tip] (natural sable darkens to its tip; synthetic and hog are even). */
const HAIR: Record<Hair, [string, string]> = {
  synthetic: ['#2a2729', '#171516'],
  sable: ['#7a5a43', '#2c1d15'],
  hog: ['#e4dccb', '#cfc4ad'],
}

/** Bristles: the hair's own colour, and (if loaded) glossy wet paint on the last part of the tips only, ragged per strand. */
function bristleMaterial(hair: Hair, wet: string | undefined) {
  const material = new MeshPhysicalMaterial({ roughness: 0.5, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, side: DoubleSide, sheen: 0.6, sheenRoughness: 0.4 })
  const uRoot = { value: new Color(HAIR[hair][0]) }
  const uTip = { value: new Color(HAIR[hair][1]) }
  const uWet = { value: new Color(wet ?? '#000000') }
  const uLoad = { value: wet ? 1 : 0 }
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, { uRoot, uTip, uWet, uLoad })
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aU;\nattribute float aSeed;\nvarying float vWet;\nvarying float vU;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvU = aU;\nvWet = smoothstep(0.66, 0.8, aU + (aSeed - 0.5) * 0.3);')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRoot;\nuniform vec3 uTip;\nuniform vec3 uWet;\nuniform float uLoad;\nvarying float vWet;\nvarying float vU;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat wetK = vWet * uLoad;\ndiffuseColor.rgb = mix(mix(uRoot, uTip, smoothstep(0.2, 0.95, vU)), uWet, wetK);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.5, 0.16, wetK);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= wetK;\n#endif')
  }
  material.customProgramCacheKey = () => 'zc-bristles-2'
  return material
}

// A long crimped ferrule: rolled lip at the mouth, two crimp rings, a seat onto the handle.
const FERRULE_PROFILE: [number, number][] = [
  [0.0262, 0.17], [0.0272, 0.172], [0.0276, 0.178], [0.0276, 0.25], [0.0264, 0.256], [0.0264, 0.262], [0.0276, 0.268],
  [0.0276, 0.282], [0.0264, 0.288], [0.0264, 0.294], [0.0276, 0.3], [0.0276, 0.33], [0.027, 0.336], [0.0256, 0.34],
]
// Slim and long: it swells just behind the ferrule and tapers to a fine tail (a real artist's brush, not a stub).
const HANDLE_PROFILE: [number, number][] = [
  [0.0256, 0.34], [0.0274, 0.37], [0.0286, 0.42], [0.0284, 0.48], [0.0268, 0.58], [0.0238, 0.72],
  [0.0198, 0.88], [0.0158, 1.04], [0.0128, 1.16], [0.0118, 1.215], [0.0108, 1.232],
]
const CAP_PROFILE: [number, number][] = [[0.0108, 1.232], [0.011, 1.236], [0.0102, 1.243], [0.0072, 1.248], [0.0001, 1.25]]
const lathe = (pts: [number, number][]) => new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), 64)
/** The handle's radius at height y (linear between the profile points). */
const handleR = (y: number) => {
  for (let i = 1; i < HANDLE_PROFILE.length; i++) {
    const [r1, y1] = HANDLE_PROFILE[i]
    const [r0, y0] = HANDLE_PROFILE[i - 1]
    if (y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0)
  }
  return HANDLE_PROFILE[HANDLE_PROFILE.length - 1][0]
}

function buildHandle(): BufferGeometry {
  const curve = new SplineCurve(HANDLE_PROFILE.map(([r, y]) => new Vector2(r, y)))
  const g = new LatheGeometry(curve.getPoints(80), 64)
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  const out = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    out[i * 2] = pos.getY(i) / 0.6
    out[i * 2 + 1] = uv.getX(i) * 0.3
  }
  g.setAttribute('uv', new Float32BufferAttribute(out, 2))
  return g
}

const LACQUER: Record<Exclude<Lacquer, 'ash'>, string> = { black: '#0c0c0e', crimson: '#7d0e1f', pearl: '#ece6d9' }

/** Shared brush parts: one head geometry per shape, one bristle material per (hair, paint) pair, one handle per lacquer. */
export function useBrushKit(specs: readonly BrushSpec[]) {
  const tex = usePBR('ash_veneer')
  return useMemo(() => {
    const ash = new MeshPhysicalMaterial({
      map: tex.map,
      normalMap: tex.normalMap,
      roughnessMap: tex.roughnessMap,
      roughness: 1,
      normalScale: new Vector2(0.35, 0.35),
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.0,
    })
    // Ash-grey varnish graded from the photo itself (desaturate, cool), never a repaint.
    ash.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n{ float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)); diffuseColor.rgb = mix(vec3(l), diffuseColor.rgb, 0.18) * vec3(0.68, 0.68, 0.70); }',
      )
    }
    ash.customProgramCacheKey = () => 'ash-grey'
    const lacquer = (color: string) =>
      new MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4 })
    const handles: Record<Lacquer, MeshPhysicalMaterial> = {
      ash,
      black: lacquer(LACQUER.black),
      crimson: lacquer(LACQUER.crimson),
      pearl: lacquer(LACQUER.pearl),
    }
    const heads = { round: buildBristles('round'), flat: buildBristles('flat'), liner: buildBristles('liner') }
    const bristles = new Map<string, MeshPhysicalMaterial>()
    for (const sp of specs) {
      const k = `${sp.hair}|${sp.wet ?? ''}`
      if (!bristles.has(k)) bristles.set(k, bristleMaterial(sp.hair, sp.wet))
    }
    return {
      heads,
      bristles,
      ferrule: lathe(FERRULE_PROFILE),
      handle: buildHandle(),
      cap: lathe(CAP_PROFILE),
      handles,
      chrome: new MeshPhysicalMaterial({ metalness: 1, color: LOOK.chrome.color, roughness: LOOK.chrome.roughness, envMapIntensity: LOOK.chrome.envMapIntensity }),
    }
  }, [tex, specs])
}
export type BrushKit = ReturnType<typeof useBrushKit>

const FOIL_Y = 0.6 // centre of the handle lettering
const FOIL_TILT = Math.atan2(handleR(0.46) - handleR(0.74), 0.28) // follows the handle's taper

export function Brush({ kit, spec }: { kit: BrushKit; spec: BrushSpec }) {
  const flat = spec.head === 'flat'
  const foilColor = spec.lacquer === 'pearl' || spec.lacquer === 'ash' ? '#26262a' : '#e6e8eb'
  return (
    <group>
      <group scale={flat ? [FLAT.x, 1, FLAT.z] : [1, 1, 1]}>
        <mesh geometry={kit.heads[spec.head]} material={kit.bristles.get(`${spec.hair}|${spec.wet ?? ''}`)} castShadow />
      </group>
      {/* A flat brush's ferrule is crimped flat at the mouth: squashed toward the hair, round where it meets the handle. */}
      <group scale={flat ? [1.32, 1, 0.62] : [1, 1, 1]}>
        <mesh geometry={kit.ferrule} material={kit.chrome} castShadow />
      </group>
      <mesh geometry={kit.handle} material={kit.handles[spec.lacquer]} castShadow />
      <mesh geometry={kit.cap} material={kit.chrome} castShadow />
      {/* Foil lettering running along the handle, like a maker's stamp. */}
      <group position={[0, FOIL_Y, handleR(FOIL_Y) + 0.0004]} rotation-x={-FOIL_TILT}>
        <Text
          font={a('fonts/GeistMono.ttf')}
          fontSize={0.0145}
          letterSpacing={0.16}
          anchorX="center"
          anchorY="middle"
          rotation-z={Math.PI / 2}
        >
          {spec.label ?? 'ZUHAYR CREATIVE'}
          <meshPhysicalMaterial metalness={1} color={foilColor} roughness={0.2} envMapIntensity={2.2} />
        </Text>
      </group>
    </group>
  )
}
