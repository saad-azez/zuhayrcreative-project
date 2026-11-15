import { use, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox, useKTX2 } from '@react-three/drei'
import { Color, InstancedMesh, Matrix4, MeshPhysicalMaterial, Quaternion, Shape, ShapeGeometry, SRGBColorSpace, Vector2, Vector3, type Texture } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { LOOK } from '../../look'
import { a, bakeUrl, usePBR } from '../../lib/assets'
import { loopT } from '../../lib/time'
import zMark from '../../../data/z-mark.json'
import { canvasFonts } from './canvasFonts'
import { ScreenReel } from './screenReel'

// The designer's corner, front left by the mirror (so the mirror shows it twice): a self-healing cutting mat with a ZC Studio
// laptop open on it (silver aluminium, polished chrome lips, a floating display, a crimson light line), its screen playing a fast-cut studio reel of design work (screenReel.ts) in step with the loop.
// The desk props are at 2.2x life size (a 14-inch laptop is 0.69 m wide).

const S = 2.2
export const DESK = { x: -1.62, z: -0.5, yaw: 0.2 } as const
const MAT = { w: 1.0, d: 0.66, t: 0.004 } as const
const BASE = { w: 0.313 * S, d: 0.221 * S, t: 0.0072 * S } as const // thinner: 7.2 mm at life size
const LIP = 0.0011 * S // the diamond-cut chrome lip round the deck
const LID = { w: BASE.w, h: 0.212 * S, t: 0.0042 * S, open: 1.92, lift: 0.006 * S } as const // lift = the floating hinge's gap
const SCREEN = { w: 0.3 * S, h: 0.1875 * S } as const // 16:10, edge to edge

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
          new Vector3(x + (wu * u) / 2, BASE.t + 0.0006 * S, z + depth / 2 + (arrows ? depth / 4 : 0)),
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
  // Silver aluminium (17 Oct, the user: "laptop needs to be silver metal not dark"): bead-blasted alu, the Metal032 scan's brushed
  // normal and roughness (CC0, 4K), no lacquer.
  const alu = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#c9ccd1',
        metalness: 1,
        roughness: 0.38,
        roughnessMap: metal.roughnessMap,
        normalMap: metal.normalMap,
        normalScale: new Vector2(0.12, 0.12),
        envMapIntensity: 1.6,
      }),
    [metal],
  )
  const chrome = useMemo(() => new MeshPhysicalMaterial({ color: '#ffffff', metalness: 1, roughness: 0.05, envMapIntensity: 2.2 }), [])
  const screenMat = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#000000',
        emissive: new Color('#ffffff'),
        emissiveMap: screenTex,
        emissiveIntensity: 0.85, // the reel has pearl and silver scenes: brighter clips them to white
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
      {/* Base: the silver aluminium slab with a diamond-cut chrome lip round the deck. */}
      <RoundedBox args={[BASE.w, BASE.t, BASE.d]} radius={0.004 * S} smoothness={4} position={[0, BASE.t / 2, 0]} material={alu} castShadow receiveShadow />
      <mesh position={[0, BASE.t - LIP / 2 + 0.0002, BASE.d / 2 - LIP / 2]} material={chrome}>
        <boxGeometry args={[BASE.w - 0.01 * S, LIP, LIP]} />
      </mesh>
      <mesh position={[0, BASE.t - LIP / 2 + 0.0002, -(BASE.d / 2 - LIP / 2)]} material={chrome}>
        <boxGeometry args={[BASE.w - 0.01 * S, LIP, LIP]} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (BASE.w / 2 - LIP / 2), BASE.t - LIP / 2 + 0.0002, 0]} material={chrome}>
          <boxGeometry args={[LIP, LIP, BASE.d - 0.01 * S]} />
        </mesh>
      ))}
      {/* The crimson light line along the front lip. */}
      <mesh position={[0, BASE.t * 0.5, BASE.d / 2 + 0.0003]}>
        <planeGeometry args={[0.26 * S, 0.0009 * S]} />
        <meshBasicMaterial color={[2.0, 0.04, 0.09]} toneMapped={false} />
      </mesh>
      {/* The keyboard well glows a dim crimson between the keys. */}
      <mesh position={[0, BASE.t + 0.0001, -BASE.d / 2 + 0.022 * S + (keys.keyDepthEnd + BASE.d / 2 - 0.022 * S) / 2 - 0.004 * S]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.285 * S, keys.keyDepthEnd + BASE.d / 2 - 0.016 * S]} />
        <meshBasicMaterial color={[0.6, 0.015, 0.045]} toneMapped={false} />
      </mesh>
      <primitive object={keyMesh} />
      {/* A big glass trackpad with a crimson-lit rim. */}
      <mesh position={[0, BASE.t + 0.0002, BASE.d / 2 - 0.055 * S]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.156 * S, 0.096 * S]} />
        <meshBasicMaterial color={[1.6, 0.03, 0.07]} toneMapped={false} />
      </mesh>
      <RoundedBox args={[0.15 * S, 0.0004 * S, 0.09 * S]} radius={0.0002 * S} smoothness={2} position={[0, BASE.t + 0.0003, BASE.d / 2 - 0.055 * S]}>
        <meshPhysicalMaterial color="#0b0b0d" roughness={0.18} clearcoat={1} clearcoatRoughness={0.05} envMapIntensity={1.2} />
      </RoundedBox>

      {/* The floating hinge: a chrome bar holds the display a few millimetres above the deck. */}
      <mesh position={[0, BASE.t + LID.lift * 0.5, -BASE.d / 2 + 0.004 * S]} rotation-z={Math.PI / 2} material={chrome}>
        <cylinderGeometry args={[0.0045 * S, 0.0045 * S, 0.22 * S, 24]} />
      </mesh>

      {/* Lid: hinged above the back edge, open to ~110 degrees. */}
      <group position={[0, BASE.t + LID.lift, -BASE.d / 2 + 0.004 * S]} rotation-x={-(LID.open - Math.PI / 2)}>
        <RoundedBox args={[LID.w, LID.h, LID.t]} radius={0.004 * S} smoothness={4} position={[0, LID.h / 2, -LID.t / 2]} material={alu} castShadow />
        {/* A chrome rim, the edge-to-edge black glass, the screen. */}
        <mesh position={[0, LID.h / 2, 0.0002]} material={chrome}>
          <planeGeometry args={[LID.w - 0.002 * S, LID.h - 0.002 * S]} />
        </mesh>
        <mesh position={[0, LID.h / 2, 0.0004]}>
          <planeGeometry args={[LID.w - 0.0042 * S, LID.h - 0.0042 * S]} />
          <meshPhysicalMaterial color="#050506" roughness={0.05} clearcoat={1} envMapIntensity={0.8} />
        </mesh>
        <mesh position={[0, LID.h / 2 + 0.002 * S, 0.0008]} material={screenMat}>
          <planeGeometry args={[SCREEN.w, SCREEN.h]} />
        </mesh>
        {/* The camera and its tiny crimson LED in the top bezel. */}
        <mesh position={[0, LID.h - 0.005 * S, 0.0006]}>
          <circleGeometry args={[0.0014 * S, 24]} />
          <meshBasicMaterial color="#0a0a0c" />
        </mesh>
        <mesh position={[0.004 * S, LID.h - 0.005 * S, 0.0006]}>
          <circleGeometry args={[0.0005 * S, 16]} />
          <meshBasicMaterial color={[1.6, 0.03, 0.07]} toneMapped={false} />
        </mesh>
        {/* The Z inlaid in polished chrome on the back of the lid (the mirror shows it). */}
        <mesh geometry={zGeo} position={[0, LID.h / 2, -LID.t - 0.0004]} rotation-y={Math.PI} scale={0.1}>
          <meshPhysicalMaterial metalness={1} color={LOOK.chrome.color} roughness={0.05} envMapIntensity={LOOK.chrome.envMapIntensity} />
        </mesh>
      </group>
      {/* The screen's glow on the mat in front of it. */}
      <pointLight position={[0, 0.2, 0.05]} intensity={0.25} distance={0.9} decay={2} color="#ffe6ea" />
    </group>
  )
}

function CuttingMat() {
  const gl = useThree((s) => s.gl)
  // The mat's print: a canvas bake (printTextures.ts drawn by /bake.html).
  const bake = useKTX2(bakeUrl('bake_mat'), a('basis/')) as Texture
  const map = useMemo(() => {
    bake.colorSpace = SRGBColorSpace
    bake.anisotropy = gl.capabilities.getMaxAnisotropy()
    bake.needsUpdate = true
    return bake
  }, [bake, gl])
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
