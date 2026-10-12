import { use, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { Color, InstancedMesh, Matrix4, MeshPhysicalMaterial, Quaternion, Shape, ShapeGeometry, Vector2, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { LOOK } from '../../look'
import { usePBR } from '../../lib/assets'
import { loopT } from '../../lib/time'
import zMark from '../../../data/z-mark.json'
import { canvasFonts } from './canvasFonts'
import { makeMatTexture } from './printTextures'
import { ScreenReel } from './screenReel'

// The designer's corner, front left by the mirror (so the mirror shows it twice): a self-healing cutting mat with a laptop
// open on it, its screen playing a fast-cut studio reel of design work (screenReel.ts) in step with the loop.
// The desk props are at 2.2x life size (a 14-inch laptop is 0.69 m wide).

const S = 2.2
export const DESK = { x: -1.62, z: -0.5, yaw: 0.2 } as const
const MAT = { w: 1.0, d: 0.66, t: 0.004 } as const
const BASE = { w: 0.313 * S, d: 0.221 * S, t: 0.0095 * S } as const
const LID = { w: BASE.w, h: 0.215 * S, t: 0.006 * S, open: 1.92 } as const // open = hinge angle from closed (radians, ~110 degrees)
const SCREEN = { w: 0.302 * S, h: 0.189 * S } as const // 16:10

/** Key rows in key units (1u = 1.8 cm before scale): each entry is a key width; row 0 is the half-height function row. */
const ROWS: number[][] = [
  [1.45, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.45],
  [1.45, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.7],
  [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.2],
  [1, 1, 1, 1.25, 4.95, 1.25, 1, 1, 1, 1],
]

function useKeys() {
  return useMemo(() => {
    const u = 0.0187 * S
    const gap = 0.0021 * S
    const mats: Matrix4[] = []
    const rowTotal = (r: number[]) => r.reduce((a, b) => a + b, 0) * u
    let z = -BASE.d / 2 + 0.022 * S
    ROWS.forEach((row, ri) => {
      const half = ri === 0
      const depth = (half ? 0.5 : 1) * u - gap
      let x = -rowTotal(ROWS[1]) / 2
      // Arrow cluster on the bottom row: the last three keys are half height, inverted-T.
      row.forEach((wu, ki) => {
        const w = wu * u - gap
        const arrows = ri === 5 && ki >= 7
        const m = new Matrix4().compose(
          new Vector3(x + (wu * u) / 2, BASE.t / 2 + 0.0006 * S, z + depth / 2 + (arrows ? depth / 4 : 0)),
          new Quaternion(),
          new Vector3(w / (0.0166 * S), 1, (arrows ? depth / 2 : depth) / (0.0166 * S)),
        )
        mats.push(m)
        x += wu * u
      })
      z += (half ? 0.5 : 1) * u
    })
    return { mats, keyDepthEnd: z }
  }, [])
}

/** The Z mark's outline as a flat shape (both halves), for the lid's inlay. */
function zShapes(): ShapeGeometry {
  const verts = zMark.vertices as unknown as Record<string, number[]>
  const make = (outline: string[]) => {
    const s = new Shape()
    outline.forEach((n, i) => (i === 0 ? s.moveTo(verts[n][0], verts[n][1]) : s.lineTo(verts[n][0], verts[n][1])))
    s.closePath()
    return s
  }
  const g = new ShapeGeometry([make(zMark.halves.top.outline), make(zMark.halves.bottom.outline)])
  g.center()
  return g
}

function Laptop() {
  use(canvasFonts())
  const metal = usePBR('Metal032', { color: false })
  const reel = useMemo(() => new ScreenReel(), [])
  useEffect(() => () => reel.dispose(), [reel])
  const screenTex = reel.texture
  const keys = useKeys()
  const keyGeo = useMemo(() => new RoundedBoxGeometry(0.0166 * S, 0.0011 * S, 0.0166 * S, 2, 0.0005 * S), [])
  const keyMesh = useMemo(() => {
    const mat = new MeshPhysicalMaterial({ color: '#0c0c0e', roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.4 })
    const im = new InstancedMesh(keyGeo, mat, keys.mats.length)
    keys.mats.forEach((m, i) => im.setMatrixAt(i, m))
    im.castShadow = true
    im.receiveShadow = true
    return im
  }, [keyGeo, keys])
  const alu = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#c4c7cc',
        metalness: 1,
        roughness: 0.34,
        normalMap: metal.normalMap,
        normalScale: new Vector2(0.12, 0.12),
        envMapIntensity: 1.5,
      }),
    [metal],
  )
  const screenMat = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#000000',
        emissive: new Color('#ffffff'),
        emissiveMap: screenTex,
        emissiveIntensity: 0.72, // the reel has pearl and silver scenes: brighter clips them to white
        roughness: 0.06,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        envMapIntensity: 0.6,
      }),
    [screenTex],
  )
  const zGeo = useMemo(zShapes, [])
  // The reel redraws itself about 12 times a second from the loop time (one small canvas upload per redraw).
  useFrame(({ clock }) => {
    reel.draw(loopT(clock.elapsedTime))
  })

  return (
    <group>
      {/* Base: the aluminium slab, the keyboard well, the keys and the trackpad. */}
      <RoundedBox args={[BASE.w, BASE.t, BASE.d]} radius={0.004 * S} smoothness={4} position={[0, BASE.t / 2, 0]} material={alu} castShadow receiveShadow />
      <mesh position={[0, BASE.t + 0.0002, -BASE.d / 2 + 0.022 * S + (keys.keyDepthEnd + BASE.d / 2 - 0.022 * S) / 2 - 0.004 * S]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.285 * S, keys.keyDepthEnd + BASE.d / 2 - 0.016 * S]} />
        <meshStandardMaterial color="#141416" roughness={0.6} />
      </mesh>
      <primitive object={keyMesh} />
      <RoundedBox args={[0.13 * S, 0.0004 * S, 0.08 * S]} radius={0.0002 * S} smoothness={2} position={[0, BASE.t, BASE.d / 2 - 0.05 * S]}>
        <meshPhysicalMaterial color="#b9bcc1" metalness={0.6} roughness={0.22} clearcoat={1} clearcoatRoughness={0.1} envMapIntensity={1.2} />
      </RoundedBox>

      {/* Lid: hinged at the back edge, open to ~110 degrees. */}
      <group position={[0, BASE.t, -BASE.d / 2 + 0.002]} rotation-x={-(LID.open - Math.PI / 2)}>
        <RoundedBox args={[LID.w, LID.h, LID.t]} radius={0.004 * S} smoothness={4} position={[0, LID.h / 2, -LID.t / 2]} material={alu} castShadow />
        {/* Black glass front with the screen. */}
        <mesh position={[0, LID.h / 2, 0.0004]}>
          <planeGeometry args={[LID.w - 0.004 * S, LID.h - 0.004 * S]} />
          <meshPhysicalMaterial color="#050506" roughness={0.05} clearcoat={1} envMapIntensity={0.8} />
        </mesh>
        <mesh position={[0, LID.h / 2 + 0.003 * S, 0.0008]} material={screenMat}>
          <planeGeometry args={[SCREEN.w, SCREEN.h]} />
        </mesh>
        {/* The Z inlaid in polished chrome on the back of the lid (the mirror shows it). */}
        <mesh geometry={zGeo} position={[0, LID.h / 2, -LID.t - 0.0004]} rotation-y={Math.PI} scale={0.1}>
          <meshPhysicalMaterial metalness={1} color={LOOK.chrome.color} roughness={0.05} envMapIntensity={LOOK.chrome.envMapIntensity} />
        </mesh>
      </group>
      {/* The screen's glow on the mat in front of it. */}
      <pointLight position={[0, 0.2, 0.05]} intensity={0.25} distance={0.9} decay={2} color="#dfe3ff" />
    </group>
  )
}

function CuttingMat() {
  const gl = useThree((s) => s.gl)
  use(canvasFonts())
  const map = useMemo(() => makeMatTexture(gl), [gl])
  return (
    <group>
      <RoundedBox args={[MAT.w, MAT.t, MAT.d]} radius={0.0019} smoothness={2} position={[0, MAT.t / 2, 0]} receiveShadow castShadow>
        <meshStandardMaterial color="#1f1f22" roughness={0.9} />
      </RoundedBox>
      <mesh position={[0, MAT.t + 0.0003, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[MAT.w - 0.004, MAT.d - 0.004]} />
        <meshStandardMaterial map={map} roughness={0.82} envMapIntensity={0.4} />
      </mesh>
    </group>
  )
}

export function Desk() {
  return (
    <group position={[DESK.x, 0, DESK.z]} rotation-y={DESK.yaw}>
      <CuttingMat />
      <group position={[0.04, MAT.t + 0.0003, 0.03]} rotation-y={0.1}>
        <Laptop />
      </group>
    </group>
  )
}
