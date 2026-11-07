import { useMemo, useRef, useState } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { RoundedBox, Text } from '@react-three/drei'
import {
  Color, DoubleSide, DynamicDrawUsage, ImageLoader, InstancedBufferAttribute, InstancedMesh, MeshPhysicalMaterial, Object3D, Plane,
  SRGBColorSpace, Texture, Vector3, type Group, type Mesh,
} from 'three'
import { TUBES, ZMARK, nozzleTip } from '../../layout'
import { FROZEN, loopT } from '../../lib/time'
import { a } from '../../lib/assets'
import { VOXEL_GEO } from '../pixels/voxelGeometry'
import { swingPoint } from '../tubes/motion'
import { lastPulse } from '../interact/squirtStore'
import { REGIONS, type RegionId } from './regions'
import { REGION_DUR, region, regionAge } from './regionStore'

const N = 26
const MAX = N * N
const HALF = 0.455 // half the mosaic's height (26 cells * 0.035 / 2)
const FLY = 0.55 // seconds a voxel flies in
const BACK = 0.45 // seconds a voxel flies home
const SCAN_COL = new Color(2.4, 0.05, 0.1) // HDR crimson
const TIPS = TUBES.map((T) => new Vector3(...nozzleTip(T)))

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const fract = (x: number) => x - Math.floor(x)
const hash = (cx: number, cy: number) => fract(Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453)
const smooth = (k: number) => k * k * (3 - 2 * k)

type Voxel = { x: number; y: number; cy: number; tube: number; te: number }
type RegionData = { voxels: Voxel[]; colors: Float32Array; tex: Texture }

/** The scan line's height (world y): bottom -> top over [2.7, 3.5], held to 7.2, back down over [7.2, 7.7]. */
function scanY(age: number): number {
  const bot = ZMARK.pos[1] - HALF
  const top = ZMARK.pos[1] + HALF
  if (age < 2.7 || age >= 7.7) return bot
  if (age < 3.5) return bot + (top - bot) * ((age - 2.7) / 0.8)
  if (age < 7.2) return top
  return top - (top - bot) * ((age - 7.2) / 0.5)
}

/**
 * While a region is picked on the Seasons rail the tubes paint that region's logo as a 26 x 26 mosaic of pixels in place of the Z:
 * the pixels fly in from the nozzles, a scan swaps them for the true logo, a name tag swings in, then it all returns to the tubes.
 */
export function RegionPaint() {
  const gl = useThree((s) => s.gl)
  const imgs = useLoader(ImageLoader, REGIONS.map((r) => a(r.file)))
  const [shown, setShown] = useState<RegionId | null>(null)

  const data = useMemo<RegionData[]>(() => {
    const aniso = gl.capabilities.getMaxAnisotropy()
    const cv = document.createElement('canvas')
    cv.width = N
    cv.height = N
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    const c = new Color()
    return imgs.map((img) => {
      ctx.clearRect(0, 0, N, N)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, N, N)
      const px = ctx.getImageData(0, 0, N, N).data
      const voxels: Voxel[] = []
      const colors: number[] = []
      for (let cy = 0; cy < N; cy++) {
        for (let cx = 0; cx < N; cx++) {
          const o = (cy * N + cx) * 4
          if (px[o + 3] <= 128) continue
          c.setRGB(px[o] / 255, px[o + 1] / 255, px[o + 2] / 255, SRGBColorSpace)
          colors.push(c.r, c.g, c.b)
          voxels.push({
            x: (cx - 12.5) * ZMARK.cell,
            y: (12.5 - cy) * ZMARK.cell,
            cy,
            tube: clamp(Math.floor((cx / N) * 4), 0, 3),
            te: 0.15 + (1.9 * (N - 1 - cy)) / (N - 1) + 0.12 * hash(cx, cy),
          })
        }
      }
      const tex = new Texture(img)
      tex.colorSpace = SRGBColorSpace
      tex.anisotropy = aniso
      tex.needsUpdate = true
      return { voxels, colors: new Float32Array(colors), tex }
    })
  }, [imgs, gl])

  const voxelMat = useMemo(
    () => new MeshPhysicalMaterial({ roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1 }),
    [],
  )
  const mesh = useMemo(() => {
    const m = new InstancedMesh(VOXEL_GEO, voxelMat, MAX)
    m.instanceColor = new InstancedBufferAttribute(new Float32Array(MAX * 3), 3)
    m.instanceMatrix.setUsage(DynamicDrawUsage)
    m.frustumCulled = false
    m.count = 0
    return m
  }, [voxelMat])

  // The true logo, shown below the scan line by a world-space clipping plane that rises.
  const clip = useMemo(() => new Plane(new Vector3(0, -1, 0), ZMARK.pos[1] - HALF), [])
  const logoMat = useMemo(
    () =>
      new MeshPhysicalMaterial({
        map: data[0].tex, transparent: true, alphaTest: 0.4, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.04,
        envMapIntensity: 1.3, side: DoubleSide, clippingPlanes: [clip],
      }),
    [data, clip],
  )

  const root = useRef<Group>(null)
  const mosaic = useRef<Group>(null)
  const logoPlane = useRef<Mesh>(null)
  const scanLine = useRef<Mesh>(null)
  const tag = useRef<Group>(null)
  const swing = useRef<Group>(null)

  const live = useRef({ id: null as RegionId | null, since: -1, fired: new Uint8Array(MAX), lastFire: [-1e9, -1e9, -1e9, -1e9] })
  const dummy = useMemo(() => new Object3D(), [])
  const S = useMemo(() => TUBES.map(() => new Vector3()), [])
  const ctl = useMemo(() => new Vector3(), [])
  const E = useMemo(() => new Vector3(), [])

  useFrame((state) => {
    const rt = root.current
    const g = mosaic.current
    if (!rt || !g) return
    if (FROZEN || !region.id) { rt.visible = false; return }
    const age = regionAge()
    if (age >= REGION_DUR) { region.id = null; rt.visible = false; return }
    rt.visible = true

    // A new pick: rewrite the colours, the voxel count and the true logo, and re-arm the nozzle pulses.
    const L = live.current
    if (L.id !== region.id || L.since !== region.since) {
      if (L.id !== region.id) {
        const d = data[REGIONS.findIndex((r) => r.id === region.id)]
        const col = mesh.instanceColor!
        ;(col.array as Float32Array).set(d.colors)
        col.needsUpdate = true
        mesh.count = d.voxels.length
        logoMat.map = d.tex
        setShown(region.id)
      }
      L.id = region.id
      L.since = region.since
      L.fired.fill(0)
    }
    const d = data[REGIONS.findIndex((r) => r.id === region.id)]

    // The mosaic turns slowly during the hold.
    g.rotation.y = 0.3 * Math.sin(Math.PI * clamp((age - 3.6) / 3.4, 0, 1))
    g.updateWorldMatrix(true, false)

    const lt = loopT(state.clock.elapsedTime)
    TUBES.forEach((T, i) => g.worldToLocal(swingPoint(T, TIPS[i], lt, S[i])))

    const ys = scanY(age)
    const showing = ys > ZMARK.pos[1] - HALF + 1e-6
    const now = performance.now()

    for (let i = 0; i < d.voxels.length; i++) {
      const v = d.voxels[i]
      E.set(v.x, v.y, 0)
      const s = S[v.tube]
      ctl.copy(s).add(E).multiplyScalar(0.5)
      ctl.y += 0.22
      ctl.z += 0.12
      let scale = 0
      let u = 1 // bezier parameter, 0 = nozzle, 1 = slot
      const tr = 7.8 + 1.0 * (v.cy / (N - 1))
      if (age >= v.te && !L.fired[i]) {
        L.fired[i] = 1
        if (now - L.lastFire[v.tube] > 120) {
          L.lastFire[v.tube] = now
          lastPulse[v.tube] = now
        }
      }
      if (age < v.te) {
        scale = 0
      } else if (age < v.te + FLY) {
        const k = (age - v.te) / FLY
        u = 1 - (1 - k) * (1 - k)
        scale = 0.6 + 0.4 * k
      } else if (age < tr) {
        scale = 1
      } else if (age < tr + BACK) {
        const k = (age - tr) / BACK
        u = (1 - k) * (1 - k) // the flight in, run backwards: the eased parameter falls from 1 (slot) to 0 (nozzle)
        scale = 0.6 + 0.4 * (1 - k)
      }
      // The scan swaps pixels for the true logo: whatever lies below the scan line is hidden while the plane shows.
      if (showing && ZMARK.pos[1] + v.y < ys) scale = 0
      const w0 = (1 - u) * (1 - u)
      const w1 = 2 * (1 - u) * u
      const w2 = u * u
      dummy.position.set(
        w0 * s.x + w1 * ctl.x + w2 * E.x,
        w0 * s.y + w1 * ctl.y + w2 * E.y,
        w0 * s.z + w1 * ctl.z + w2 * E.z,
      )
      dummy.scale.setScalar(Math.max(scale, 1e-5))
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true

    // The true logo and its scan line.
    clip.constant = ys
    if (logoPlane.current) logoPlane.current.visible = showing
    const scanning = (age >= 2.7 && age < 3.5) || (age >= 7.2 && age < 7.7)
    if (scanLine.current) {
      scanLine.current.visible = scanning
      scanLine.current.position.y = ys - ZMARK.pos[1]
    }

    // The name tag: scales in over [3.4, 3.8], out over [7.4, 7.8], swinging like a hung tag.
    const tg = tag.current
    if (tg) {
      const s = age < 3.4 ? 0 : age < 3.8 ? smooth((age - 3.4) / 0.4) : age < 7.4 ? 1 : age < 7.8 ? 1 - smooth((age - 7.4) / 0.4) : 0
      tg.visible = s > 0
      tg.scale.setScalar(Math.max(s, 1e-4))
    }
    if (swing.current) swing.current.rotation.z = 0.05 * Math.sin(2.4 * age)
  })

  const r = REGIONS.find((x) => x.id === shown)

  return (
    <group ref={root} visible={false}>
      <group ref={mosaic} position={[...ZMARK.pos]}>
        <primitive object={mesh} />
        <mesh ref={logoPlane} position={[0, 0, 0.022]} material={logoMat} visible={false}>
          <planeGeometry args={[0.91, 0.91]} />
        </mesh>
        <mesh ref={scanLine} position={[0, 0, 0.03]} visible={false}>
          <planeGeometry args={[0.95, 0.006]} />
          <meshBasicMaterial color={SCAN_COL} toneMapped={false} />
        </mesh>
      </group>
      <group ref={tag} position={[0.66, 1.02, -0.5]} rotation={[0, -0.25, 0]} visible={false}>
        <group ref={swing}>
          <RoundedBox args={[0.46, 0.2, 0.004]} radius={0.01} smoothness={3}>
            <meshPhysicalMaterial color="#fbfaf7" roughness={0.5} />
          </RoundedBox>
          <mesh position={[-0.205, 0, 0.003]}>
            <torusGeometry args={[0.012, 0.003, 12, 24]} />
            <meshPhysicalMaterial metalness={1} color="#ffffff" roughness={0.05} envMapIntensity={2.2} />
          </mesh>
          {r && (
            <>
              <Text font={a('fonts/Anton-Regular.ttf')} fontSize={0.062} letterSpacing={0.06} color="#1a1a1a" anchorX="center" anchorY="middle" position={[0.02, 0.05, 0.003]}>
                {r.city}
              </Text>
              <Text font={a('fonts/GeistMono.ttf')} fontSize={0.024} letterSpacing={0.14} color="#7d0e1f" anchorX="center" anchorY="middle" position={[0.02, -0.012, 0.003]}>
                {r.season}
              </Text>
              <Text font={a('fonts/GeistMono.ttf')} fontSize={0.016} letterSpacing={0.14} color="#77777d" anchorX="center" anchorY="middle" position={[0.02, -0.065, 0.003]}>
                ZUHAYR CREATIVE · SEASONS
              </Text>
            </>
          )}
        </group>
      </group>
    </group>
  )
}
