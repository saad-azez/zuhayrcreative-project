import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Group,
  type Object3D,
  type SpotLight,
} from 'three'
import { BOX } from '../layout'
import { LOOK, type SpotCfg } from '../look'
import { sharedMaterial } from '../lib/sharedMaterial'
import { ambientT } from '../lib/time'

// The window's lamps. Every head you can see is a real spot light aimed where it points (11 Oct: before, four of the nine heads
// were props and the studio environment lit the paper almost white on its own, so the spots made no visible pool or shadow).
// Each lamp: a can with a glowing lens, its stem or bracket, the light itself and a faint beam of light in the air.

type V3 = readonly [number, number, number]
const BLACK = { color: '#0d0d0d', metalness: 0.6, roughness: 0.4 } as const
// Every head, stem, bar and bracket is this one metal: one material between them (lib/sharedMaterial.ts).
const BLACK_MAT = sharedMaterial('standard', BLACK)
const BLACK_TWO_SIDED = sharedMaterial('standard', { ...BLACK, side: DoubleSide })
const UP = new Vector3(0, 1, 0)

/** One spot light with its own scene-resident target, linked once both exist. */
function Spot({ cfg }: { cfg: SpotCfg }) {
  const light = useRef<SpotLight>(null)
  const target = useRef<Object3D>(null)
  useLayoutEffect(() => {
    if (light.current && target.current) light.current.target = target.current
  }, [])
  return (
    <>
      <spotLight
        ref={light}
        position={cfg.pos as unknown as [number, number, number]}
        angle={cfg.angle}
        penumbra={cfg.penumbra}
        intensity={cfg.intensity}
        color={cfg.color}
        decay={2}
        distance={cfg.reach ?? 0}
        castShadow={cfg.shadow}
        {...(cfg.shadow
          ? {
              'shadow-mapSize': [2048, 2048],
              'shadow-bias': -0.0001,
              'shadow-normalBias': 0.02,
              'shadow-camera-near': 0.2,
              'shadow-camera-far': 8,
            }
          : {})}
      />
      <object3D ref={target} position={cfg.target as unknown as [number, number, number]} />
    </>
  )
}

/** One lamp head (can, lit lens and back ring), pointing its local +z at `aim`. It casts no shadow: it sits where the light is. */
function SpotHead({ pos, aim }: { pos: V3; aim: V3 }) {
  const ref = useRef<Group>(null)
  useLayoutEffect(() => {
    ref.current?.lookAt(new Vector3(aim[0], aim[1], aim[2]))
  }, [aim])
  const lens = LOOK.beams.lens
  return (
    <group ref={ref} position={pos as unknown as [number, number, number]}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.045, 0.045, 0.14, 32, 1, true]} />
        <primitive object={BLACK_TWO_SIDED} attach="material" />
      </mesh>
      {/* Inside the can, a short black baffle so the lens sits recessed. */}
      <mesh position={[0, 0, 0.05]}>
        <circleGeometry args={[0.044, 32]} />
        <meshBasicMaterial color={[lens, lens * 0.84, lens * 0.62]} toneMapped={false} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, 0, -0.07]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 32]} />
        <primitive object={BLACK_MAT} attach="material" />
      </mesh>
    </group>
  )
}

const beamVert = /* glsl */ `
  varying float vV;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vWorld;
  void main() {
    vV = uv.y;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`
const beamFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying float vV;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vWorld;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  void main() {
    // vV: 1 at the lens, 0 at the far end. Bright near the lamp, gone before it reaches a surface (no hard intersection line).
    float v = clamp(vV, 0.0, 1.0); // perspective interpolation can dip a hair below 0, and pow() of a negative is NaN
    float along = pow(v, 1.6) * smoothstep(0.0, 0.25, v);
    // Soft edges: the cone's silhouette fades out, its middle (seen through the most air) stays.
    float edge = pow(abs(dot(normalize(vN), normalize(vView))), 1.5);
    // Slow drifting haze so the beam breathes.
    float haze = 0.75 + 0.5 * noise(vWorld * 3.0 + vec3(0.0, -uTime * 0.12, uTime * 0.05));
    float a = uOpacity * along * edge * haze;
    gl_FragColor = vec4(uColor * a, a);
  }`

/** A faint additive cone of light from the lens toward the target, fading out before it lands. */
function Beam({ cfg }: { cfg: SpotCfg }) {
  const { geo, pos, quat } = useMemo(() => {
    const p = new Vector3(...cfg.pos)
    const t = new Vector3(...cfg.target)
    const dir = t.clone().sub(p)
    const len = dir.length() * 0.92
    dir.normalize()
    const r = Math.tan(cfg.angle) * len * 0.85
    // Cylinder with the narrow end (the lens, uv.y = 1) at +y; shifted so +y sits at the origin, then pointed along dir.
    const g = new CylinderGeometry(0.04, r, len, 48, 12, true)
    g.translate(0, -len / 2, 0)
    const q = new Quaternion().setFromUnitVectors(UP, dir.clone().negate())
    return { geo: g, pos: p.add(dir.clone().multiplyScalar(0.06)), quat: q }
  }, [cfg])
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uColor: { value: new Color(cfg.color) },
          uOpacity: { value: LOOK.beams.opacity * cfg.beam },
          uTime: { value: 0 },
        },
        vertexShader: beamVert,
        fragmentShader: beamFrag,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    [cfg],
  )
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = ambientT(clock.elapsedTime)
  })
  return <mesh geometry={geo} material={mat} position={pos} quaternion={quat} renderOrder={5} frustumCulled={false} />
}

/** The ceiling track across the front of the box; its heads hang on stems. */
function CeilingTrack({ heads }: { heads: SpotCfg[] }) {
  const trackY = BOX.h - 0.035
  const z = heads[0].pos[2]
  const xs = heads.map((h) => h.pos[0])
  const x0 = Math.min(...xs) - 0.35
  const x1 = Math.max(...xs) + 0.35
  return (
    <group>
      <mesh position={[(x0 + x1) / 2, BOX.h - 0.0175, z]}>
        <boxGeometry args={[x1 - x0, 0.035, 0.035]} />
        <primitive object={BLACK_MAT} attach="material" />
      </mesh>
      {heads.map((h, i) => {
        const stemH = trackY - h.pos[1]
        return (
          <mesh key={i} position={[h.pos[0], h.pos[1] + stemH / 2, h.pos[2]]}>
            <cylinderGeometry args={[0.008, 0.008, stemH, 12]} />
            <primitive object={BLACK_MAT} attach="material" />
          </mesh>
        )
      })}
    </group>
  )
}

/** The two side bars standing in the jambs, a bracket per head (the Hermès tubes reference's side bars). */
function JambBars({ heads }: { heads: SpotCfg[] }) {
  return (
    <>
      {([-1, 1] as const).map((sx) => {
        const mine = heads.filter((h) => Math.sign(h.pos[0]) === sx)
        if (!mine.length) return null
        const barX = sx * (Math.abs(mine[0].pos[0]) + 0.07)
        const z = mine[0].pos[2] + 0.025
        return (
          <group key={sx}>
            <mesh position={[barX, 0.3 + 2.75 / 2, z]}>
              <boxGeometry args={[0.025, 2.75, 0.025]} />
              <primitive object={BLACK_MAT} attach="material" />
            </mesh>
            {mine.map((h) => (
              <mesh key={h.pos[1]} position={[(h.pos[0] + barX) / 2, h.pos[1], z]}>
                <boxGeometry args={[Math.abs(barX - h.pos[0]), 0.012, 0.012]} />
                <primitive object={BLACK_MAT} attach="material" />
              </mesh>
            ))}
          </group>
        )
      })}
    </>
  )
}

export function Lights() {
  const all = Object.values(LOOK.spots) as SpotCfg[]
  const track = all.filter((s) => s.mount === 'track')
  const jamb = all.filter((s) => s.mount === 'jamb')
  return (
    <>
      {all.map((cfg, i) => (
        <group key={i}>
          <Spot cfg={cfg} />
          <SpotHead pos={cfg.pos} aim={cfg.target} />
          {cfg.beam > 0 && <Beam cfg={cfg} />}
        </group>
      ))}
      <CeilingTrack heads={track} />
      <JambBars heads={jamb} />
    </>
  )
}
