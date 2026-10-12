import { useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { MeshReflectorMaterial, Text, useKTX2 } from '@react-three/drei'
import {
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  FrontSide,
  Group,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Texture,
} from 'three'
import { BOX, INK, PAPER, PORTAL, SIDE } from '../layout'
import { LOOK } from '../look'
import { a, TEX_VERSION, usePBR } from '../lib/assets'
import { worldBoxUV } from '../lib/worldUV'
import { logoTexture } from '../lib/logoTexture'

// The box: black marble floor, dark red brushed-metal walls, a dark ceiling with a lamp track, the dark red portal frame
// with a fine wordmark, silver-leaf gilding on the open window's plane (no glass), and the photographer's paper
// sweep hanging from its roll.
// The left side wall is the mirror (MirrorWall.tsx).

type V3 = readonly [number, number, number]

/** A shared tray-shaped footprint: the glass-width edge at z 0 and the narrower back edge at z -1.9 (sign flips the z). */
function footprint(zSign: 1 | -1) {
  const s = new Shape()
  s.moveTo(-BOX.halfW, 0)
  s.lineTo(BOX.halfW, 0)
  s.lineTo(BOX.backHalfW, zSign * -BOX.backZ)
  s.lineTo(-BOX.backHalfW, zSign * -BOX.backZ)
  s.closePath()
  return s
}

const FLOOR_DEFINES = { 'defines-USE_UV': '' } as object

/** Black marble under everything, a real planar reflector so the Z and the tubes stand in their own reflection. */
function Floor() {
  const pbr = usePBR('Marble016')
  const geo = useMemo(() => {
    const g = new ShapeGeometry(footprint(1))
    return worldBoxUV(g, LOOK.marble.tile)
  }, [])
  return (
    <mesh geometry={geo} rotation-x={-Math.PI / 2} receiveShadow>
      <MeshReflectorMaterial
        // drei adds this define to the material the first time its shader is built, which changes what the material is: the
        // renderer then took the next frame's lookup for a new program and built the same shader a second time (about
        // half a second with the page stopped). Set from the start, the first build is the only one.
        {...FLOOR_DEFINES}
        map={pbr.map}
        normalMap={pbr.normalMap}
        roughnessMap={pbr.roughnessMap}
        normalScale={new Vector2(LOOK.marble.normalScale, LOOK.marble.normalScale)}
        resolution={1024}
        blur={[300, 100]}
        mixBlur={1}
        mixStrength={LOOK.marble.mixStrength}
        mirror={LOOK.marble.mirror}
        depthScale={0}
        metalness={0}
        roughness={1}
        envMapIntensity={LOOK.marble.envMapIntensity}
      />
    </mesh>
  )
}

/** The right wall and the back wall in dark red brushed metal (the left wall is the mirror). */
function Walls() {
  const pbr = usePBR('Metal032', { color: false })
  const normalScale = useMemo(() => new Vector2(LOOK.boxMetal.normalScale, LOOK.boxMetal.normalScale), [])
  const right = useMemo(() => {
    const g = new PlaneGeometry(SIDE.len, BOX.h)
    g.rotateY(-(Math.PI / 2 - SIDE.splay))
    g.translate((BOX.halfW + BOX.backHalfW) / 2, BOX.h / 2, BOX.backZ / 2)
    return worldBoxUV(g, LOOK.boxMetal.tile)
  }, [])
  const back = useMemo(() => {
    const g = new PlaneGeometry(2 * BOX.backHalfW, BOX.h)
    g.translate(0, BOX.h / 2, BOX.backZ)
    return worldBoxUV(g, LOOK.boxMetal.tile)
  }, [])
  const material = (
    <meshPhysicalMaterial
      metalness={1}
      color={LOOK.boxMetal.wall}
      roughness={LOOK.boxMetal.wallRoughness}
      roughnessMap={pbr.roughnessMap}
      normalMap={pbr.normalMap}
      normalScale={normalScale}
      clearcoat={LOOK.boxMetal.clearcoat}
      clearcoatRoughness={LOOK.boxMetal.clearcoatRoughness}
      envMapIntensity={LOOK.boxMetal.envMapIntensity}
    />
  )
  return (
    <>
      <mesh geometry={right} receiveShadow>
        {material}
      </mesh>
      <mesh geometry={back} receiveShadow>
        {material}
      </mesh>
    </>
  )
}

/** The ceiling in the same brushed metal, darker. */
function Ceiling() {
  const pbr = usePBR('Metal032', { color: false })
  const normalScale = useMemo(() => new Vector2(0.5, 0.5), [])
  const geo = useMemo(() => worldBoxUV(new ShapeGeometry(footprint(-1)), LOOK.boxMetal.tile), [])
  return (
    <mesh geometry={geo} position={[0, BOX.h, 0]} rotation-x={Math.PI / 2}>
      <meshPhysicalMaterial
        metalness={1}
        color={LOOK.boxMetal.ceiling}
        roughness={LOOK.boxMetal.ceilingRoughness}
        roughnessMap={pbr.roughnessMap}
        normalMap={pbr.normalMap}
        normalScale={normalScale}
        envMapIntensity={LOOK.boxMetal.envMapIntensity}
        side={DoubleSide}
      />
    </mesh>
  )
}


/** The dark red brushed-metal frame around the opening, with the chrome ZUHAYR CREATIVE lettering on its bottom rail. */
function Portal() {
  const pbr = usePBR('Metal032', { color: false })
  const geo = useMemo(() => {
    const outer = new Shape()
    outer.moveTo(-PORTAL.outerHalfW, PORTAL.bottom)
    outer.lineTo(PORTAL.outerHalfW, PORTAL.bottom)
    outer.lineTo(PORTAL.outerHalfW, PORTAL.top)
    outer.lineTo(-PORTAL.outerHalfW, PORTAL.top)
    outer.closePath()
    const hole = new Path()
    hole.moveTo(-BOX.halfW, 0)
    hole.lineTo(-BOX.halfW, BOX.h)
    hole.lineTo(BOX.halfW, BOX.h)
    hole.lineTo(BOX.halfW, 0)
    hole.closePath()
    outer.holes.push(hole)
    const g = new ExtrudeGeometry(outer, {
      depth: BOX.frameZ1 - BOX.frameZ0,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 3,
    })
    g.translate(0, 0, BOX.frameZ0)
    return worldBoxUV(g, 1.0)
  }, [])
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshPhysicalMaterial
          metalness={1}
          color={LOOK.boxMetal.frame}
          roughness={LOOK.boxMetal.roughness}
          clearcoat={LOOK.boxMetal.clearcoat}
          clearcoatRoughness={LOOK.boxMetal.clearcoatRoughness}
          normalMap={pbr.normalMap}
          roughnessMap={pbr.roughnessMap}
          envMapIntensity={LOOK.boxMetal.envMapIntensity}
        />
      </mesh>
      {/* A small, fine wordmark only (11 Oct, the user: no Z here, the box already has its hero Z). */}
      <Text font={a('fonts/GeistMono.ttf')} fontSize={0.04} letterSpacing={0.62} anchorX="center" anchorY="middle" position={[0, -0.11, PORTAL.faceZ]}>
        ZUHAYR CREATIVE
        {/* Unlit silver-white so it reads on the dark red rail whatever the light (11 Oct, the user: more legible). */}
        <meshBasicMaterial color="#e4e6ea" />
      </Text>
    </group>
  )
}

/**
 * The box's outside: the window can now be looked at from the side (CameraRig), so the dark red metal carries on round the
 * back of the frame as a closed case (the interior walls are single-sided and would otherwise show through).
 */
function Shell() {
  const pbr = usePBR('Metal032', { color: false })
  const ns = useMemo(() => new Vector2(LOOK.boxMetal.normalScale, LOOK.boxMetal.normalScale), [])
  const W = PORTAL.outerHalfW
  const z0 = BOX.frameZ0
  const z1 = BOX.backZ - 0.2
  const D = z0 - z1
  const H = PORTAL.top - PORTAL.bottom
  const yc = (PORTAL.top + PORTAL.bottom) / 2
  const mat = (
    <meshPhysicalMaterial
      metalness={1}
      color={LOOK.boxMetal.frame}
      roughness={LOOK.boxMetal.roughness}
      clearcoat={LOOK.boxMetal.clearcoat}
      clearcoatRoughness={LOOK.boxMetal.clearcoatRoughness}
      normalMap={pbr.normalMap}
      roughnessMap={pbr.roughnessMap}
      normalScale={ns}
      envMapIntensity={LOOK.boxMetal.envMapIntensity}
    />
  )
  return (
    <group>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * W, yc, (z0 + z1) / 2]} rotation-y={s * (Math.PI / 2)}>
          <planeGeometry args={[D, H]} />
          {mat}
        </mesh>
      ))}
      <mesh position={[0, PORTAL.top, (z0 + z1) / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2 * W, D]} />
        {mat}
      </mesh>
      <mesh position={[0, PORTAL.bottom, (z0 + z1) / 2]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[2 * W, D]} />
        {mat}
      </mesh>
      <mesh position={[0, yc, z1]} rotation-y={Math.PI}>
        <planeGeometry args={[2 * W, H]} />
        {mat}
      </mesh>
    </group>
  )
}

/**
 * Silver-leaf gilding on the window plane, bottom left and right, as before the glass came out (11 Oct, the user preferred the
 * small original tag; it is now ~20% larger). The pane itself is gone, so the leaf sits on the open window's plane.
 */
function Gilding() {
  // Silver-white leaf, unlit so the fine lettering stays legible against the paper, the floor and the red box.
  const gild = <meshBasicMaterial color="#e4e6ea" />
  const zh = useMemo(() => logoTexture('zh-z', 512, { mono: '#e4e6ea' }), [])
  return (
    <group>
      <Text font={a('fonts/GeistMono.ttf')} fontSize={0.032} letterSpacing={0.18} anchorX="left" anchorY="bottom" position={[-(BOX.halfW - 0.1), 0.08, BOX.glassZ + 0.001]}>
        WEB DESIGN · AI AUTOMATION · SEARCH GROWTH · BRAND SYSTEMS
        {gild}
      </Text>
      <Text font={a('fonts/GeistMono.ttf')} fontSize={0.031} letterSpacing={0.18} anchorX="right" anchorY="bottom" position={[BOX.halfW - 0.1 - 0.105, 0.08, BOX.glassZ + 0.001]}>
        HONG KONG — A CONCERN OF ZUHAYR HOLDINGS
        {gild}
      </Text>
      {/* The ZUHAYR HOLDINGS Z, a small silver-leaf mark closing the tag line. */}
      <mesh position={[BOX.halfW - 0.1 - 0.045, 0.08 + 0.032, BOX.glassZ + 0.001]}>
        <planeGeometry args={[0.09, 0.09]} />
        <meshBasicMaterial map={zh} transparent depthWrite={false} color="#ffffff" />
      </mesh>
    </group>
  )
}

/**
 * The seamless paper: one swept ribbon down the wall, round the cove and out across the floor, curling up a touch at its
 * front edge. The wall drawing (the ink layer) is composited into the paper's colour in the shader, so the ink takes the
 * paper's own grain and light. Profile normals point into the room (+z on the wall, +y on the floor).
 */
function PaperSweep() {
  const gl = useThree((s) => s.gl)
  const pbr = usePBR('Paper001')
  const ink = useKTX2(a(`tex/4k/wall_ink.ktx2?v=${TEX_VERSION}`), a('basis/')) as Texture

  const geo = useMemo(() => {
    // The profile in the (z, y) plane with its normal, walked from the roll to the front edge.
    const pts: { z: number; y: number; nz: number; ny: number }[] = []
    const wallSteps = 24
    for (let i = 0; i <= wallSteps; i++) {
      const t = i / wallSteps
      pts.push({ z: PAPER.wallZ, y: PAPER.rollY + (PAPER.coveR - PAPER.rollY) * t, nz: 1, ny: 0 })
    }
    const R = PAPER.coveR
    const cz = PAPER.wallZ + R
    const cy = R
    const coveSteps = 24
    for (let i = 1; i <= coveSteps; i++) {
      const phi = ((Math.PI / 2) * i) / coveSteps
      pts.push({ z: cz - R * Math.cos(phi), y: cy - R * Math.sin(phi), nz: Math.cos(phi), ny: Math.sin(phi) })
    }
    const floorEnd = PAPER.frontZ - 0.05
    const floorSteps = 16
    for (let i = 1; i <= floorSteps; i++) {
      pts.push({ z: cz + ((floorEnd - cz) * i) / floorSteps, y: 0.003, nz: 0, ny: 1 })
    }
    const curlSteps = 6
    for (let i = 1; i <= curlSteps; i++) {
      const z = floorEnd + ((PAPER.frontZ - floorEnd) * i) / curlSteps
      const k = (z - floorEnd) / 0.05
      const len = Math.hypot(1, 0.4 * k)
      pts.push({ z, y: 0.003 + 0.01 * k * k, nz: (-0.4 * k) / len, ny: 1 / len })
    }

    const n = pts.length
    const pos = new Float32Array(n * 2 * 3)
    const nor = new Float32Array(n * 2 * 3)
    const uv = new Float32Array(n * 2 * 2)
    const inkUv = new Float32Array(n * 2 * 2)
    let l = 0
    for (let i = 0; i < n; i++) {
      if (i > 0) l += Math.hypot(pts[i].z - pts[i - 1].z, pts[i].y - pts[i - 1].y)
      for (let s = 0; s < 2; s++) {
        const x = s === 0 ? -PAPER.halfW : PAPER.halfW
        const v = i * 2 + s
        pos.set([x, pts[i].y, pts[i].z], v * 3)
        nor.set([0, pts[i].ny, pts[i].nz], v * 3)
        uv.set([x / LOOK.paper.tile, l / LOOK.paper.tile], v * 2)
        inkUv.set([(x - INK.x0) / (INK.x1 - INK.x0), (INK.y1 - pts[i].y) / (INK.y1 - INK.y0)], v * 2)
      }
    }
    const index: number[] = []
    for (let i = 0; i < n - 1; i++) {
      const A = i * 2, B = i * 2 + 1, C = (i + 1) * 2, D = (i + 1) * 2 + 1
      index.push(A, C, B, B, C, D)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('normal', new BufferAttribute(nor, 3))
    g.setAttribute('uv', new BufferAttribute(uv, 2))
    g.setAttribute('inkUv', new BufferAttribute(inkUv, 2))
    g.setIndex(index)
    return g
  }, [])

  const mat = useMemo(() => {
    const mat = new MeshStandardMaterial({
      ...pbr,
      color: LOOK.paper.tint,
      metalness: LOOK.paper.metalness,
      roughness: LOOK.paper.roughness,
      normalScale: new Vector2(LOOK.paper.normalScale, LOOK.paper.normalScale),
      envMapIntensity: LOOK.paper.envMapIntensity,
      side: FrontSide,
    })
    // The KTX2 ink arrives already sRGB-tagged and clamped; re-flagging it for upload (needsUpdate) broke the paper's
    // shadow sampling (the tubes' shadows rendered as bright ghosts), so it is used exactly as loaded.
    return mat
  }, [pbr, ink, gl])

  // The drawing is its own decal over the hanging paper (exactly the INK rectangle, a hair in front), lit like the paper.
  const inkGeo = useMemo(() => {
    const g = new PlaneGeometry(INK.x1 - INK.x0, INK.y1 - INK.y0)
    // KTX2 is not flipped: v = 0 must sample the image's top row, so the plane's top edge gets v = 0.
    const uv = g.getAttribute('uv')
    for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - uv.getY(k))
    g.translate((INK.x0 + INK.x1) / 2, (INK.y0 + INK.y1) / 2, PAPER.wallZ + 0.0008)
    return g
  }, [])
  const inkMat = useMemo(
    () => new MeshStandardMaterial({ map: ink, transparent: true, depthWrite: false, roughness: 0.85, envMapIntensity: LOOK.paper.envMapIntensity, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    [ink],
  )

  return (
    <>
      {/* The paper takes the spots' shadows (the earlier "bright ghosts" were the lit gaps between the tubes' shadows). */}
      <mesh geometry={geo} material={mat} receiveShadow />
      <mesh geometry={inkGeo} material={inkMat} receiveShadow />
    </>
  )
}

/** The roll the sweep comes off, hung from the ceiling on two chrome rods. */
function PaperRoll() {
  const pbr = usePBR('Paper001')
  const rollGeo = useMemo(() => {
    const g = new CylinderGeometry(PAPER.rollR, PAPER.rollR, 2 * PAPER.halfW + 0.1, 96)
    g.rotateZ(Math.PI / 2)
    return g
  }, [])
  const axleGeo = useMemo(() => {
    const g = new CylinderGeometry(0.012, 0.012, 2 * PAPER.halfW + 0.22, 24)
    g.rotateZ(Math.PI / 2)
    return g
  }, [])
  const rz = PAPER.wallZ + PAPER.rollR
  const rodH = BOX.h - PAPER.rollY
  const chrome = (
    <meshStandardMaterial metalness={1} color={LOOK.chrome.color} roughness={LOOK.chrome.roughness} envMapIntensity={LOOK.chrome.envMapIntensity} />
  )
  return (
    <group>
      <mesh geometry={rollGeo} position={[0, PAPER.rollY, rz]} castShadow>
        <meshStandardMaterial {...pbr} color={LOOK.paper.tint} metalness={LOOK.paper.metalness} roughness={LOOK.paper.roughness} />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <group key={s}>
          <mesh position={[s * (PAPER.halfW + 0.0505), PAPER.rollY, rz]} rotation-y={s * (Math.PI / 2)}>
            <ringGeometry args={[0.03, 0.036, 48]} />
            <meshStandardMaterial color="#5a5752" roughness={0.9} />
          </mesh>
          <mesh position={[s * (PAPER.halfW + 0.0505), PAPER.rollY, rz]} rotation-y={s * (Math.PI / 2)}>
            <circleGeometry args={[0.03, 48]} />
            <meshStandardMaterial color="#151515" />
          </mesh>
          <mesh position={[s * (PAPER.halfW + 0.09), PAPER.rollY + rodH / 2, rz]}>
            <cylinderGeometry args={[0.008, 0.008, rodH, 16]} />
            {chrome}
          </mesh>
          <mesh position={[s * (PAPER.halfW + 0.09), BOX.h - 0.005, rz]}>
            <cylinderGeometry args={[0.03, 0.03, 0.01, 32]} />
            {chrome}
          </mesh>
        </group>
      ))}
      <mesh geometry={axleGeo} position={[0, PAPER.rollY, rz]}>
        {chrome}
      </mesh>
    </group>
  )
}

export function Room() {
  return (
    <>
      <Floor />
      <Walls />
      <Ceiling />
      <Portal />
      <Gilding />
      <Shell />
      <PaperSweep />
      <PaperRoll />
    </>
  )
}
