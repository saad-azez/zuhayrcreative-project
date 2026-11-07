import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, useKTX2 } from '@react-three/drei'
import { Color, DoubleSide, MeshPhysicalMaterial, SRGBColorSpace, type Texture, PlaneGeometry, Quaternion, Vector3, type IUniform } from 'three'
import { a, bakeUrl } from '../../lib/assets'
import { FROZEN } from '../../lib/time'
import { REGIONS } from './regions'
import { startRegion } from './regionStore'

const P0 = new Vector3(1.73, 2.82, -1.72)
const P1 = new Vector3(2.27, 2.82, -0.28)
const CEIL = 3.1
const SCARF_W = 0.36
const SCARF_L = 1.45
const UP = new Vector3(0, 1, 0)
const AXIS_Z = new Vector3(0, 0, 1)

/** The shared chrome of the rail, its drop rods, discs and rings. */
function Chrome() {
  return <meshPhysicalMaterial metalness={1} color="#ffffff" roughness={0.05} envMapIntensity={2.2} />
}

/** A cylinder of radius r from one point to another. */
function Rod({ from, to, r }: { from: Vector3; to: Vector3; r: number }) {
  const { pos, quat, len } = useMemo(() => {
    const dir = to.clone().sub(from)
    return {
      pos: from.clone().add(to).multiplyScalar(0.5),
      quat: new Quaternion().setFromUnitVectors(UP, dir.clone().normalize()),
      len: dir.length(),
    }
  }, [from, to])
  return (
    <mesh position={pos} quaternion={quat}>
      <cylinderGeometry args={[r, r, len, 16]} />
      <Chrome />
    </mesh>
  )
}

/**
 * The banner's drape (17 Oct, the user: "an organic natural ripple drape down the banner but not too strong so it can still be
 * legible"). One surface z(x, d, t) on the plane (d = 0 at the ring, 1.45 at the hem): soft vertical folds that deepen toward the
 * hem and drift/twist slowly, a gentle wave travelling down the length, and a slow sway. CLOTH_NORMAL tilts the normal by the
 * same surface's derivatives so the light shows the folds; CLOTH_GLSL moves the vertices. (The plane's normal is +z.)
 */
const CLOTH_NORMAL = /* glsl */ `
  // Tuning (17 Oct): folds FOLD0..FOLD0+FOLD1 m deep (ring → hem); a wave WAVE_A m high at the hem, WAVE_K rad/m, WAVE_W rad/s.
  #define FOLD0 0.006
  #define FOLD1 0.012
  #define WAVE_A 0.055
  #define WAVE_K 8.0
  #define WAVE_W 2.0
  float cd = clamp(-position.y, 0.0, 1.45);
  float cu = cd / 1.45;
  float cw = pow(cu, 1.2);
  float cwd = 1.2 * pow(max(cu, 1e-4), 0.2) / 1.45;
  float cph = 0.6 * sin(0.35 * uT + uSeed) + 1.2 * cd + uSeed;
  float caf = FOLD0 + FOLD1 * cw;
  float cfa = 41.9 * position.x + cph;
  float cs = WAVE_K * cd - WAVE_W * uT + uSeed;
  float csw = sin(0.5 * uT + 1.3 * uSeed);
  float cz = caf * sin(cfa) + WAVE_A * cw * sin(cs) + 0.03 * cw * csw;
  float cdzdx = caf * 41.9 * cos(cfa);
  float cdzdd = FOLD1 * cwd * sin(cfa) + caf * 1.2 * cos(cfa) + WAVE_A * (cwd * sin(cs) + cw * WAVE_K * cos(cs)) + 0.03 * cwd * csw;
  objectNormal = normalize(vec3(-cdzdx, cdzdd, 1.0));
`
const CLOTH_GLSL = /* glsl */ `
  transformed.z += cz;
  transformed.x += 0.02 * cw * sin(0.7 * uT + uSeed);
`

/**
 * The Seasons rail on the right wall: a chrome rail with four silk scarves, one per region, hanging from rings and turned to the
 * street. Clicking a scarf makes the tubes paint that region's logo (RegionPaint).
 */
/** The banner bakes, one per region; shared with ShopPreload. */
export const bannerUrls = () => REGIONS.map((r) => bakeUrl(`bake_scarf_${r.id}`))

export function SeasonsRail() {
  const gl = useThree((s) => s.gl)
  // The banners' prints: canvas bakes (scarfTexture.ts drawn by /bake.html), one per region.
  const bakes = useKTX2(bannerUrls(), a('basis/')) as Texture[]
  const textures = useMemo(() => bakes.map((t) => {
    t.colorSpace = SRGBColorSpace
    t.anisotropy = gl.capabilities.getMaxAnisotropy()
    t.needsUpdate = true
    return t
  }), [bakes, gl])
  const geo = useMemo(() => new PlaneGeometry(SCARF_W, SCARF_L, 24, 72).translate(0, -SCARF_L / 2, 0), [])

  const scarves = useMemo(
    () =>
      REGIONS.map((_, i) => {
        const uT: IUniform<number> = { value: 0 }
        const uSeed: IUniform<number> = { value: i * 1.7 + 0.3 }
        const mat = new MeshPhysicalMaterial({
          map: textures[i],
          side: DoubleSide,
          roughness: 0.42,
          sheen: 1,
          sheenRoughness: 0.35,
          sheenColor: new Color('#ffffff'),
          clearcoat: 0.15,
          clearcoatRoughness: 0.4,
          envMapIntensity: 0.9,
        })
        mat.onBeforeCompile = (shader) => {
          shader.uniforms.uT = uT
          shader.uniforms.uSeed = uSeed
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float uT;\nuniform float uSeed;')
            .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + CLOTH_NORMAL)
            .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + CLOTH_GLSL)
        }
        mat.customProgramCacheKey = () => 'zc-scarf-ripple-3'
        const u = 0.1 + 0.27 * i
        const h = P0.clone().lerp(P1, u)
        return { mat, uT, h }
      }),
    [textures],
  )

  const railDir = useMemo(() => P1.clone().sub(P0).normalize(), [])
  const ringQuat = useMemo(() => new Quaternion().setFromUnitVectors(AXIS_Z, railDir), [railDir])
  const ends = useMemo(
    () => [
      { top: new Vector3(P0.x, CEIL, P0.z), foot: P0 },
      { top: new Vector3(P1.x, CEIL, P1.z), foot: P1 },
    ],
    [],
  )

  useFrame((state) => {
    const t = FROZEN ? 0 : state.clock.elapsedTime
    for (const s of scarves) s.uT.value = t
  })

  return (
    <group>
      <Rod from={P0} to={P1} r={0.011} />
      {ends.map((e, k) => (
        <group key={k}>
          <Rod from={e.foot} to={e.top} r={0.006} />
          <mesh position={[e.top.x, CEIL - 0.006, e.top.z]}>
            <cylinderGeometry args={[0.05, 0.05, 0.012, 24]} />
            <Chrome />
          </mesh>
        </group>
      ))}
      {scarves.map((s, i) => {
        const yaw = -0.42 + 0.06 * i
        return (
          <group key={REGIONS[i].id} position={[s.h.x, s.h.y, s.h.z]} rotation={[0, yaw, 0]}>
            <mesh position={[0, 0, 0]} quaternion={ringQuat.clone().premultiply(new Quaternion().setFromAxisAngle(UP, -yaw))}>
              <torusGeometry args={[0.03, 0.004, 12, 32]} />
              <Chrome />
            </mesh>
            <mesh
              geometry={geo}
              material={s.mat}
              position={[0, -0.03, 0]}
              castShadow
              receiveShadow
              onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
              onPointerOut={() => { document.body.style.cursor = '' }}
              onClick={(e) => { e.stopPropagation(); startRegion(REGIONS[i].id) }}
            />
            <Text
              font={a('fonts/GeistMono.ttf')}
              fontSize={0.022}
              letterSpacing={0.12}
              anchorX="center"
              anchorY="middle"
              position={[0, -0.06, 0.012]}
            >
              {REGIONS[i].city}
              <meshBasicMaterial color="#e4e6ea" />
            </Text>
          </group>
        )
      })}
    </group>
  )
}
