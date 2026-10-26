import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler, InstancedMesh, Matrix4, Plane, Quaternion, Raycaster, SphereGeometry, Vector2, Vector3 } from 'three'
import { TUBES, ZMARK, nozzleTip, type PaintId } from '../../layout'
import { swingPoint } from '../tubes/motion'
import { PAINT_MATERIALS } from '../pixels/paintMaterials'
import { VOXEL_GEO } from '../pixels/voxelGeometry'
import { loopT, FROZEN } from '../../lib/time'
import { lastPulse } from './squirtStore'

/**
 * Click / click-and-hold squirts extra paint (11 Oct, the user: "click / click-hold -> tubes squirt extra paint onto the floor
 * that fades"). The window's theme is paint turning into pixels, so the paint lands as a glossy puddle that then breaks into
 * pixels and sinks away. The tube nearest the aimed floor point (in x) presses in (squirtStore) and throws drops that land
 * there. This is live interaction, outside the pure loop, and it is off entirely when the loop is frozen (capture, reduced
 * motion, a pinned review moment).
 */

const PAINTS: PaintId[] = ['pearl', 'crimson', 'oxblood', 'chrome']
const MAX_DROPS = 160
const MAX_PUDDLES = 60
const MAX_PIX = 360
const G = 9.8
const G_VEC = new Vector3(0, -G, 0)
const UP = new Vector3(0, 1, 0)
const FLOOR = new Plane(new Vector3(0, 1, 0), -0.004)
const TIP_X = TUBES.map((T) => nozzleTip(T)[0])
const ZERO = new Matrix4().makeScale(0, 0, 0)
/** The settled-pixel geometry's own edge, so an instance scale of 1 / EDGE gives a cube of exactly one metre. */
const EDGE = ZMARK.cell * 0.94

type Drop = { alive: boolean; born: number; tf: number; p0: Vector3; v0: Vector3; r: number }
type Puddle = { alive: boolean; born: number; x: number; z: number; r: number; seed: number }
type Pix = { alive: boolean; born: number; x: number; z: number; s: number; seed: number }
type Pool = { drops: Drop[]; dropAt: number; puddles: Puddle[]; puddleAt: number; pix: Pix[]; pixAt: number }

function makePools(): Pool[] {
  return PAINTS.map(() => ({
    drops: Array.from({ length: MAX_DROPS }, () => ({ alive: false, born: 0, tf: 0, p0: new Vector3(), v0: new Vector3(), r: 0 })),
    dropAt: 0,
    puddles: Array.from({ length: MAX_PUDDLES }, () => ({ alive: false, born: 0, x: 0, z: 0, r: 0, seed: 0 })),
    puddleAt: 0,
    pix: Array.from({ length: MAX_PIX }, () => ({ alive: false, born: 0, x: 0, z: 0, s: 0, seed: 0 })),
    pixAt: 0,
  }))
}

/**
 * Draws only the live prefix of a pool: zero-scale instances never produce fragments, so the pixels are identical, but an idle
 * pool no longer costs triangles in every pass and every shadow pass. `hi` = highest live index + 1. The matrices are re-uploaded
 * only while something is live, plus once when the pool has just gone empty.
 */
function trimPool(mesh: InstancedMesh, hi: number) {
  const prev = mesh.userData.liveCount as number | undefined
  mesh.count = hi
  mesh.visible = hi > 0
  if (hi > 0 || prev !== 0) mesh.instanceMatrix.needsUpdate = true
  mesh.userData.liveCount = hi
}

type Meshes = { drops: (InstancedMesh | null)[]; puddles: (InstancedMesh | null)[]; pix: (InstancedMesh | null)[] }

export function Squirt() {
  const gl = useThree((s) => s.gl)
  const geo = useMemo(() => new SphereGeometry(1, 20, 14), [])
  const pools = useRef<Pool[] | null>(null)
  if (!pools.current) pools.current = makePools()
  const meshes = useRef<Meshes>({ drops: [], puddles: [], pix: [] })

  // The pointer: its normalised position, whether a press is held (and still a squirt, not a camera drag), and the click burst.
  const input = useRef({ ndcX: 0, ndcY: 0, have: false, active: false, downX: 0, downY: 0, burstLeft: 0, burstAcc: 0, acc: 0 })

  useEffect(() => {
    if (FROZEN) return
    const el = gl.domElement
    const I = input.current
    const setNdc = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      I.ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
      I.ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      I.have = true
    }
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' && e.button !== 0) return
      // An interactive prop is under the pointer (it shows the pointer cursor), or the visitor is doing a modified gesture.
      if (document.body.style.cursor === 'pointer' || e.shiftKey) return
      I.active = true
      I.downX = e.clientX
      I.downY = e.clientY
      setNdc(e)
      // The first drop leaves on the very next frame; a plain click is a short burst of five over the next 0.2 s.
      I.acc = 0.045
      I.burstLeft = 5
      I.burstAcc = 0
    }
    const move = (e: PointerEvent) => {
      setNdc(e)
      if (I.active && Math.hypot(e.clientX - I.downX, e.clientY - I.downY) > 6) I.active = false // a camera drag
    }
    const up = () => {
      I.active = false
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('pointerleave', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('pointerleave', up)
      I.active = false
    }
  }, [gl])

  const scratch = useMemo(
    () => ({
      ray: new Raycaster(),
      ndc: new Vector2(),
      hit: new Vector3(),
      tip: new Vector3(),
      target: new Vector3(),
      pos: new Vector3(),
      vel: new Vector3(),
      scl: new Vector3(),
      q: new Quaternion(),
      yaw: new Euler(),
      m: new Matrix4(),
    }),
    [],
  )

  useFrame((state, dt) => {
    if (FROZEN) return
    const now = state.clock.elapsedTime
    const P = pools.current!
    const I = input.current
    const S = scratch

    // Aim: the pointer's ray onto the paper floor, clamped to the floor's extent; the nearest tube (in x) answers.
    let aimed = false
    if (I.have) {
      S.ndc.set(I.ndcX, I.ndcY)
      S.ray.setFromCamera(S.ndc, state.camera)
      if (S.ray.ray.intersectPlane(FLOOR, S.hit)) {
        S.hit.x = Math.min(1.65, Math.max(-1.65, S.hit.x))
        S.hit.z = Math.min(-0.2, Math.max(-1.45, S.hit.z))
        aimed = true
      }
    }

    const emit = () => {
      let ti = 0
      for (let i = 1; i < TUBES.length; i++) if (Math.abs(TIP_X[i] - S.hit.x) < Math.abs(TIP_X[ti] - S.hit.x)) ti = i
      const T = TUBES[ti]
      const pool = P[PAINTS.indexOf(T.paint)]
      const d = pool.drops[pool.dropAt]
      pool.dropAt = (pool.dropAt + 1) % MAX_DROPS
      swingPoint(T, S.tip.set(...nozzleTip(T)), loopT(now), d.p0)
      d.p0.y -= 0.02
      d.tf = 0.55 + 0.1 * Math.random()
      S.target.set(S.hit.x + (Math.random() * 2 - 1) * 0.06, 0.004, S.hit.z + (Math.random() * 2 - 1) * 0.06)
      // v0 = ((target - p0) - 0.5 g t^2) / t, so the drop lands on the target after tf seconds under gravity.
      d.v0.copy(S.target).sub(d.p0).addScaledVector(G_VEC, -0.5 * d.tf * d.tf).divideScalar(d.tf)
      d.r = 0.016 + 0.01 * Math.random()
      d.born = now
      d.alive = true
      lastPulse[ti] = performance.now()
    }

    if (aimed) {
      if (I.active) {
        I.acc += dt
        while (I.acc >= 0.045) {
          I.acc -= 0.045
          emit()
        }
      }
      if (I.burstLeft > 0) {
        I.burstAcc += dt
        while (I.burstLeft > 0 && I.burstAcc >= 0.04) {
          I.burstAcc -= 0.04
          I.burstLeft--
          emit()
        }
      }
    }

    for (let pi = 0; pi < PAINTS.length; pi++) {
      const pool = P[pi]

      // Drops: ballistic, stretched along their velocity; on landing they become (or feed) a puddle.
      const dm = meshes.current.drops[pi]
      let dhi = 0
      for (let i = 0; i < MAX_DROPS; i++) {
        const d = pool.drops[i]
        if (d.alive) {
          const t = now - d.born
          if (t >= d.tf) {
            d.alive = false
            const lx = d.p0.x + d.v0.x * d.tf
            const lz = d.p0.z + d.v0.z * d.tf
            const pr = d.r * 3.2
            let merged = false
            for (const p of pool.puddles) {
              if (p.alive && Math.hypot(p.x - lx, p.z - lz) < 0.05) {
                p.r = Math.min(0.16, Math.sqrt(p.r * p.r + pr * pr))
                p.born = now
                merged = true
                break
              }
            }
            if (!merged) {
              const p = pool.puddles[pool.puddleAt]
              pool.puddleAt = (pool.puddleAt + 1) % MAX_PUDDLES
              p.alive = true
              p.born = now
              p.x = lx
              p.z = lz
              p.r = pr
              p.seed = Math.random()
            }
          }
        }
        if (dm) {
          if (d.alive) {
            const t = now - d.born
            S.pos.copy(d.p0).addScaledVector(d.v0, t).addScaledVector(G_VEC, 0.5 * t * t)
            S.vel.copy(d.v0).addScaledVector(G_VEC, t)
            const sp = S.vel.length()
            S.q.setFromUnitVectors(UP, S.vel.divideScalar(sp || 1))
            S.scl.set(d.r, d.r * (1 + 0.6 * Math.min(sp / 4, 1)), d.r)
            dm.setMatrixAt(i, S.m.compose(S.pos, S.q, S.scl))
            dhi = i + 1
          } else dm.setMatrixAt(i, ZERO)
        }
      }
      if (dm) trimPool(dm, dhi)

      // Puddles: spread in over 0.18 s, rest glossy, then pixelate at 2.6 s.
      const pm = meshes.current.puddles[pi]
      let phi = 0
      for (let i = 0; i < MAX_PUDDLES; i++) {
        const p = pool.puddles[i]
        if (p.alive && now - p.born >= 2.6) {
          p.alive = false
          const n = Math.round(Math.min(14, Math.max(4, p.r / 0.012)))
          for (let k = 0; k < n; k++) {
            const px = pool.pix[pool.pixAt]
            pool.pixAt = (pool.pixAt + 1) % MAX_PIX
            const rr = p.r * Math.sqrt(Math.random())
            const ang = Math.random() * Math.PI * 2
            px.alive = true
            px.born = now
            px.x = p.x + Math.cos(ang) * rr
            px.z = p.z + Math.sin(ang) * rr
            px.s = ZMARK.cell * (0.55 + 0.3 * Math.random())
            px.seed = Math.random()
          }
        }
        if (pm) {
          if (p.alive) {
            const k = Math.min(1, (now - p.born) / 0.18)
            const e = 1 - (1 - k) ** 3
            S.pos.set(p.x, 0.0035, p.z)
            S.q.setFromEuler(S.yaw.set(0, p.seed * 6.28, 0))
            S.scl.set(p.r * e, 0.0035 + 0.006 * (1 - e), p.r * e * (0.9 + 0.1 * Math.sin(p.seed * 6.3)))
            pm.setMatrixAt(i, S.m.compose(S.pos, S.q, S.scl))
            phi = i + 1
          } else pm.setMatrixAt(i, ZERO)
        }
      }
      if (pm) trimPool(pm, phi)

      // Pixels: pop up, then sink away.
      const xm = meshes.current.pix[pi]
      let xhi = 0
      for (let i = 0; i < MAX_PIX; i++) {
        const px = pool.pix[i]
        let f = 0
        if (px.alive) {
          const a = now - px.born
          f = a < 0.15 ? a / 0.15 : Math.max(0, 1 - (a - 0.15 - 0.25 * px.seed) / 1.2)
          if (a >= 0.15 && f <= 0) px.alive = false
        }
        if (xm) {
          if (px.alive && f > 0) {
            const sz = px.s * f
            S.pos.set(px.x, sz / 2 + 0.0015, px.z)
            S.q.setFromEuler(S.yaw.set(0, px.seed * 6.28, 0))
            S.scl.setScalar(sz / EDGE)
            xm.setMatrixAt(i, S.m.compose(S.pos, S.q, S.scl))
            xhi = i + 1
          } else xm.setMatrixAt(i, ZERO)
        }
      }
      if (xm) trimPool(xm, xhi)
    }
  })

  return FROZEN ? null : (
    <group>
      {PAINTS.map((p, i) => (
        <group key={p}>
          <instancedMesh
            ref={(m) => { meshes.current.drops[i] = m }}
            args={[geo, PAINT_MATERIALS[p], MAX_DROPS]}
            castShadow
            receiveShadow
            frustumCulled={false}
          />
          <instancedMesh
            ref={(m) => { meshes.current.puddles[i] = m }}
            args={[geo, PAINT_MATERIALS[p], MAX_PUDDLES]}
            castShadow
            receiveShadow
            frustumCulled={false}
          />
          <instancedMesh
            ref={(m) => { meshes.current.pix[i] = m }}
            args={[VOXEL_GEO, PAINT_MATERIALS[p], MAX_PIX]}
            castShadow
            receiveShadow
            frustumCulled={false}
          />
        </group>
      ))}
    </group>
  )
}
