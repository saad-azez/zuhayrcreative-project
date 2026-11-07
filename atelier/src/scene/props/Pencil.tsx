import { useMemo } from 'react'
import { Text } from '@react-three/drei'
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LatheGeometry,
  MeshPhysicalMaterial,
  Vector2,
  type WebGLProgramParametersWithUniforms,
} from 'three'
import { LOOK } from '../../look'
import { a, usePBR } from '../../lib/assets'

// The Zuhayr Creative pencil at the props' 2.2x scale: a hexagonal body in gloss lacquer with its name in chrome foil, sharpened
// to a point (the ash-grey wood and the scalloped lacquer edge come out of the same geometry: the solid is the hexagonal
// prism cut by the sharpening cone, so the scallops are exact), a crimped chrome ferrule and a crimson eraser.
// Local frame: the point at the origin, the pencil running up +y. Rest it on a flat face by rotating about y by a multiple of 60°.

const S = 2.2
export const PENCIL = {
  len: 0.175 * S,
  rc: 0.0041 * S, // hexagon corner radius
  ri: 0.0041 * S * Math.cos(Math.PI / 6), // across-flats radius
  graphite: 0.005 * S, // exposed lead length
  cone: 0.025 * S, // tip to where the cone reaches the corners
  ferrule: 0.009 * S,
  eraser: 0.006 * S,
} as const

/** The pencil's radius at angle phi on its rounded hexagon (flats centred at 0, 60, 120... degrees). */
function hexR(phi: number): number {
  const seg = Math.PI / 3
  let d = (((phi % seg) + seg) % seg) - seg / 2
  d = Math.abs(d) // 0 at a corner? no: 0 at the middle of a flat after the shift below
  return Math.min(PENCIL.ri / Math.cos(seg / 2 - d), PENCIL.rc * 0.982)
}
const coneR = (y: number) => 0.0002 + (y / PENCIL.cone) * (PENCIL.rc - 0.0002)

/** Body + sharpened end as one surface: radius = min(cone(y), hexagon(phi)). Attributes carry y and phi for the shader. */
function buildBody(): BufferGeometry {
  const A = 96 // around (16 per flat)
  const ys: number[] = []
  for (let y = 0; y < PENCIL.cone * 1.05; y += 0.0009) ys.push(y)
  const bodyEnd = PENCIL.len - PENCIL.ferrule - PENCIL.eraser + 0.002
  ys.push(PENCIL.cone * 1.1, bodyEnd * 0.5, bodyEnd)
  const pos: number[] = []
  const uv: number[] = []
  const aY: number[] = []
  const aPhi: number[] = []
  for (const y of ys) {
    for (let k = 0; k <= A; k++) {
      const phi = (k / A) * Math.PI * 2
      const r = Math.min(coneR(y), hexR(phi))
      pos.push(Math.cos(phi) * r, y, Math.sin(phi) * r)
      uv.push(k / A, y / 0.6)
      aY.push(y)
      aPhi.push(phi)
    }
  }
  const idx: number[] = []
  for (let j = 0; j < ys.length - 1; j++) {
    for (let k = 0; k < A; k++) {
      const p = j * (A + 1) + k
      const q = p + A + 1
      idx.push(p, q, p + 1, p + 1, q, q + 1)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setAttribute('aY', new Float32BufferAttribute(aY, 1))
  g.setAttribute('aPhi', new Float32BufferAttribute(aPhi, 1))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

export type PencilLacquer = 'black' | 'crimson' | 'pearl' | 'chrome'
/** The pencils' gloss lacquers: black (the house pencil), brand crimson, pearl and a silver 'chrome' lacquer. */
const LACQUERS: Record<PencilLacquer, string> = { black: '#0d0d0f', crimson: '#7d0e1f', pearl: '#ece6d9', chrome: '#b9bcc2' }

/** Shared geometry + materials for every pencil. */
export function usePencilKit() {
  const ash = usePBR('ash_veneer')
  return useMemo(() => {
    const body = buildBody()
    const makeMat = (lacquer: string) => {
    const mat = new MeshPhysicalMaterial({
      map: ash.map,
      normalMap: ash.normalMap,
      normalScale: new Vector2(0.3, 0.3),
      roughness: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.1,
    })
    const uLacquer = { value: new Color(lacquer) }
    const uGraphite = { value: new Color('#2a2a2d') }
    mat.onBeforeCompile = (sh: WebGLProgramParametersWithUniforms) => {
      sh.uniforms.uLacquer = uLacquer
      sh.uniforms.uGraphite = uGraphite
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aY;\nattribute float aPhi;\nvarying float vY;\nvarying float vPhi;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvY = aY;\nvPhi = aPhi;')
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform vec3 uLacquer;
          uniform vec3 uGraphite;
          varying float vY;
          varying float vPhi;
          float zone; // 0 lacquer, 1 wood, 2 graphite
          float hexR(float phi) {
            float seg = 1.0471976;
            float d = abs(mod(phi, seg) - seg * 0.5);
            return min(${PENCIL.ri.toFixed(6)} / cos(seg * 0.5 - d), ${(PENCIL.rc * 0.982).toFixed(6)});
          }
          float coneR(float y) { return 0.0002 + (y / ${PENCIL.cone.toFixed(6)}) * (${PENCIL.rc.toFixed(6)} - 0.0002); }`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          zone = vY < ${PENCIL.graphite.toFixed(6)} ? 2.0 : (coneR(vY) < hexR(vPhi) - 0.00002 ? 1.0 : 0.0);
          // Ash in grey varnish, graded from the scan itself (desaturated, cooled), never a repaint.
          { float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)); diffuseColor.rgb = mix(vec3(l), diffuseColor.rgb, 0.18) * vec3(0.74, 0.74, 0.76); }
          if (zone == 0.0) diffuseColor.rgb = uLacquer;
          if (zone == 2.0) diffuseColor.rgb = uGraphite;`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\nroughnessFactor = zone == 0.0 ? 0.22 : zone == 2.0 ? 0.32 : 0.75;',
        )
        .replace(
          '#include <metalnessmap_fragment>',
          '#include <metalnessmap_fragment>\nmetalnessFactor = zone == 2.0 ? 0.55 : 0.0;',
        )
        .replace(
          '#include <lights_physical_fragment>',
          '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= zone == 0.0 ? 1.0 : 0.0;\n#endif',
        )
    }
    mat.customProgramCacheKey = () => 'zc-pencil'
    return mat
    }
    const mats: Record<PencilLacquer, MeshPhysicalMaterial> = {
      black: makeMat(LACQUERS.black),
      crimson: makeMat(LACQUERS.crimson),
      pearl: makeMat(LACQUERS.pearl),
      chrome: makeMat(LACQUERS.chrome),
    }
    const mat = mats.black

    // Ferrule (crimped chrome) and eraser, lathed.
    const f0 = PENCIL.len - PENCIL.ferrule - PENCIL.eraser
    const rf = PENCIL.rc * 1.04
    const ferrulePts: [number, number][] = [
      [PENCIL.ri * 0.98, f0], [rf, f0 + 0.001], [rf, f0 + 0.004], [rf * 0.96, f0 + 0.0055], [rf, f0 + 0.007], [rf, f0 + 0.011],
      [rf * 0.96, f0 + 0.0125], [rf, f0 + 0.014], [rf, PENCIL.len - PENCIL.eraser - 0.0005], [rf * 0.97, PENCIL.len - PENCIL.eraser],
    ]
    const ferrule = new LatheGeometry(ferrulePts.map(([r, y]) => new Vector2(r, y)), 64)
    const e0 = PENCIL.len - PENCIL.eraser
    const re = rf * 0.95
    const eraserPts: [number, number][] = [[re, e0 - 0.001], [re, PENCIL.len - 0.003], [re * 0.9, PENCIL.len - 0.0008], [re * 0.6, PENCIL.len], [0.0001, PENCIL.len]]
    const eraser = new LatheGeometry(eraserPts.map(([r, y]) => new Vector2(r, y)), 48)
    const chrome = new MeshPhysicalMaterial({ metalness: 1, color: LOOK.chrome.color, roughness: 0.16, envMapIntensity: LOOK.chrome.envMapIntensity })
    const rubber = new MeshPhysicalMaterial({ color: '#c4010d', roughness: 0.62, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new Color('#ff6b80') })
    return { body, mat, mats, ferrule, eraser, chrome, rubber }
  }, [ash])
}
export type PencilKit = ReturnType<typeof usePencilKit>

/** One pencil. `label` faces the flat at phi = 180 degrees (local -x). */
export function Pencil({ kit, label = 'ZUHAYR CREATIVE  ·  PAINT TO PIXEL  ·  2B', lacquer = 'black' }: { kit: PencilKit; label?: string; lacquer?: PencilLacquer }) {
  const foil = lacquer === 'pearl' || lacquer === 'chrome' ? '#26262a' : '#e6e8eb'
  const foilY = PENCIL.cone + (PENCIL.len - PENCIL.ferrule - PENCIL.eraser - PENCIL.cone) / 2
  return (
    <group>
      <mesh geometry={kit.body} material={kit.mats[lacquer]} castShadow receiveShadow />
      <mesh geometry={kit.ferrule} material={kit.chrome} castShadow />
      <mesh geometry={kit.eraser} material={kit.rubber} castShadow />
      <Text
        font={a('fonts/GeistMono.ttf')}
        fontSize={0.0072}
        letterSpacing={0.14}
        anchorX="center"
        anchorY="middle"
        position={[-PENCIL.ri - 0.0002, foilY, 0]}
        rotation={[0, -Math.PI / 2, Math.PI / 2]}
      >
        {label}
        <meshPhysicalMaterial metalness={1} color={foil} roughness={0.18} envMapIntensity={2.2} />
      </Text>
    </group>
  )
}
