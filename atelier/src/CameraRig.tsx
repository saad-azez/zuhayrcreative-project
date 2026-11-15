import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { Euler, MathUtils, Matrix4, Quaternion, Vector3, type PerspectiveCamera } from 'three'
import { useFrame } from '@react-three/fiber'
import { damp3, damp } from 'maath/easing'
import { LOOK } from './look'
import { CAPTURE, STILL } from './lib/time'

/**
 * The camera. It rests on the hero framing (eased toward the pointer for parallax, the device tilt on phones, dollied by page
 * scroll; the base distance widens in portrait so the whole window fits).
 * The whole box hovers with the pointer (LOOK.hover): a lean toward it, a small drift and a slow bob, done on the camera.
 * The viewer can also look around (11 Oct, the user:
 * "i cant move around the camera angle much"):
 *   drag            orbit round the window (about 34 degrees each way, from a little below to well above)
 *   shift/right-drag pan across it          wheel (once you've grabbed the window) or pinch   zoom in to the details
 *   double-click    back to the hero view   left alone for 12 s, it drifts back to the hero view by itself
 * Phones: one-finger horizontal drag orbits (vertical swipes still scroll the page), two fingers pinch-zoom.
 * A capture and reduced motion hold the settled hero pose, so the poster is exactly the frame the live scene settles on.
 */
/** Review only: `?view=x,y,z,tx,ty,tz,fov` pins the camera there (frozen, no parallax or scroll). */
const VIEW: number[] | null = (() => {
  const r = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('view')
  if (!r) return null
  const n = r.split(',').map(Number)
  return n.length === 7 && n.every(Number.isFinite) ? n : null
})()

const LIM = {
  az: 0.6, // radians each way
  elMin: -0.12,
  elMax: 0.32,
  zoomMin: 0.45, // fraction of the hero distance
  zoomMax: 1.2,
  panX: 1.3, // metres
  panY: 0.7,
} as const
const IDLE_RETURN_MS = 12000

type Orbit = { az: number; el: number; zoom: number; px: number; py: number }
const HERO: Orbit = { az: 0, el: 0, zoom: 1, px: 0, py: 0 }
// The box's hover (LOOK.hover), applied to the camera as its inverse.
const HV = LOOK.hover
const PIVOT = new Vector3(HV.pivot[0], HV.pivot[1], HV.pivot[2])
const hEuler = new Euler()
const hQuat = new Quaternion()
const hRot = new Matrix4()
const hA = new Matrix4()
const hB = new Matrix4()
const hInv = new Matrix4()

export function CameraRig({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const pointer = useRef({ x: 0, y: 0 })
  const desired = useMemo(() => new Vector3(), [])
  const target = useMemo(() => new Vector3(...LOOK.camera.target), [])
  const look = useMemo(() => new Vector3(), [])
  const off = useMemo(() => new Vector3(), [])
  const frozen = STILL || CAPTURE !== null
  const goal = useRef<Orbit>({ ...HERO })
  const cur = useRef<Orbit>({ ...HERO })
  const engaged = useRef(0) // 0 = hero/parallax, 1 = the viewer is looking around (eased)
  const lastTouch = useRef(-Infinity)
  const returning = useRef(false)
  const base = useMemo(() => new Vector3(LOOK.camera.pos[0], LOOK.camera.pos[1], LOOK.camera.pos[2]), [])
  const lookW = useMemo(() => new Vector3(), [])
  const hov = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (frozen) return
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove)
    // Phones have no pointer to follow, so the tilt of the device stands in for it (iOS simply sends nothing without permission).
    const onTilt = (e: DeviceOrientationEvent) => {
      pointer.current.x = MathUtils.clamp((e.gamma ?? 0) / 25, -1, 1)
      pointer.current.y = MathUtils.clamp(-((e.beta ?? 50) - 50) / 25, -1, 1)
    }
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
    if (coarse) window.addEventListener('deviceorientation', onTilt)

    // ---- looking around ----
    const el = containerRef.current
    const g = goal.current
    const touch = () => { lastTouch.current = performance.now(); returning.current = false }
    const clampGoal = () => {
      g.az = MathUtils.clamp(g.az, -LIM.az, LIM.az)
      g.el = MathUtils.clamp(g.el, LIM.elMin, LIM.elMax)
      g.zoom = MathUtils.clamp(g.zoom, LIM.zoomMin, LIM.zoomMax)
      g.px = MathUtils.clamp(g.px, -LIM.panX, LIM.panX)
      g.py = MathUtils.clamp(g.py, -LIM.panY, LIM.panY)
    }
    const active = new Map<number, { x: number; y: number; sx: number; sy: number; cap: boolean }>()
    let pinch0 = 0
    let zoom0 = 1
    let mode: 'orbit' | 'pan' = 'orbit'
    const onDown = (e: PointerEvent) => {
      if (!el) return
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return
      active.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, cap: false })
      mode = e.button === 2 || e.shiftKey ? 'pan' : 'orbit'
      if (active.size === 2) {
        const [a, b] = [...active.values()]
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y)
        zoom0 = g.zoom
      }
      el.style.cursor = 'grabbing'
      touch()
    }
    const onDrag = (e: PointerEvent) => {
      const prev = active.get(e.pointerId)
      if (!prev) return
      // Capture only once it is really a drag (> 4 px): a plain click must reach the scene's own click handlers.
      if (!prev.cap && Math.hypot(e.clientX - prev.sx, e.clientY - prev.sy) > 4) {
        prev.cap = true
        try { el?.setPointerCapture(e.pointerId) } catch { /* synthetic or already-released pointer */ }
      }
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      prev.x = e.clientX
      prev.y = e.clientY
      const h = el?.clientHeight || window.innerHeight
      if (active.size >= 2) {
        const [a, b] = [...active.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch0 > 0) g.zoom = zoom0 * (pinch0 / Math.max(d, 1))
      } else if (mode === 'pan') {
        const k = (3.2 * g.zoom) / h
        g.px -= dx * k
        g.py += dy * k
      } else {
        g.az -= (dx / h) * 2.2
        // A touch drag only orbits sideways, so vertical swipes keep scrolling the page.
        if (e.pointerType !== 'touch') g.el += (dy / h) * 1.6
      }
      clampGoal()
      touch()
    }
    const onUp = (e: PointerEvent) => {
      active.delete(e.pointerId)
      if (active.size < 2) pinch0 = 0
      if (el && active.size === 0) el.style.cursor = 'grab'
    }
    const onWheel = (e: WheelEvent) => {
      // Plain wheel scrolls the page unless the viewer has just grabbed the window; a trackpad pinch (ctrl+wheel) always zooms.
      const engagedNow = performance.now() - lastTouch.current < IDLE_RETURN_MS && !returning.current
      if (!e.ctrlKey && !engagedNow) return
      e.preventDefault()
      g.zoom *= Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))
      clampGoal()
      touch()
    }
    const onDbl = () => {
      Object.assign(g, HERO)
      returning.current = true
      lastTouch.current = -Infinity
    }
    const onCtx = (e: MouseEvent) => e.preventDefault()
    if (el) {
      el.style.cursor = 'grab'
      el.style.touchAction = 'pan-y'
      el.addEventListener('pointerdown', onDown)
      el.addEventListener('pointermove', onDrag)
      el.addEventListener('pointerup', onUp)
      el.addEventListener('pointercancel', onUp)
      el.addEventListener('wheel', onWheel, { passive: false })
      el.addEventListener('dblclick', onDbl)
      el.addEventListener('contextmenu', onCtx)
    }
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (coarse) window.removeEventListener('deviceorientation', onTilt)
      if (el) {
        el.removeEventListener('pointerdown', onDown)
        el.removeEventListener('pointermove', onDrag)
        el.removeEventListener('pointerup', onUp)
        el.removeEventListener('pointercancel', onUp)
        el.removeEventListener('wheel', onWheel)
        el.removeEventListener('dblclick', onDbl)
        el.removeEventListener('contextmenu', onCtx)
      }
    }
  }, [frozen, containerRef])

  useFrame(({ camera, size }, delta) => {
    if (VIEW) {
      const pc = camera as PerspectiveCamera
      camera.position.set(VIEW[0], VIEW[1], VIEW[2])
      camera.lookAt(VIEW[3], VIEW[4], VIEW[5])
      if (pc.fov !== VIEW[6]) { pc.fov = VIEW[6]; pc.updateProjectionMatrix() }
      return
    }
    const fovRad = MathUtils.degToRad(LOOK.camera.fov)
    const aspect = size.width / size.height
    const fit = Math.max(LOOK.camera.pos[2], LOOK.camera.minDistFit / (Math.tan(fovRad / 2) * aspect))

    let p = 0.5
    const el = containerRef.current
    if (el && !frozen) {
      const rect = el.getBoundingClientRect()
      p = MathUtils.clamp((window.innerHeight - rect.top) / (window.innerHeight + rect.height), 0, 1)
    }

    // Idle: drift back to the hero view.
    const g = goal.current
    if (!frozen && !returning.current && performance.now() - lastTouch.current > IDLE_RETURN_MS) {
      if (g.az !== 0 || g.el !== 0 || g.zoom !== 1 || g.px !== 0 || g.py !== 0) {
        Object.assign(g, HERO)
        returning.current = true
      }
    }
    const c = cur.current
    const lam = returning.current ? 1.2 : 7 // slow and graceful going home, crisp under the hand
    if (frozen) Object.assign(c, HERO)
    else {
      damp(c, 'az', g.az, 1 / lam, delta)
      damp(c, 'el', g.el, 1 / lam, delta)
      damp(c, 'zoom', g.zoom, 1 / lam, delta)
      damp(c, 'px', g.px, 1 / lam, delta)
      damp(c, 'py', g.py, 1 / lam, delta)
    }
    const away = Math.min(1, Math.abs(c.az) / 0.05 + Math.abs(c.el) / 0.05 + Math.abs(c.zoom - 1) / 0.05 + (Math.abs(c.px) + Math.abs(c.py)) / 0.05)
    damp(engaged, 'current', away, 0.25, delta)

    // The hero pose (parallax fades out while the viewer is looking around), then the orbit applied about the target.
    const par = frozen ? 0 : 1 - engaged.current
    const nx = par * pointer.current.x
    const ny = par * pointer.current.y
    desired.set(
      LOOK.camera.pos[0] + nx * LOOK.camera.parallax[0],
      LOOK.camera.pos[1] + ny * LOOK.camera.parallax[1],
      fit + (0.5 - p) * LOOK.camera.scrollDolly,
    )
    look.set(target.x + c.px, target.y + c.py, target.z)
    off.copy(desired).sub(target)
    // Elevation about the camera's right axis, azimuth about world up, then the zoom.
    const r = off.length()
    const az0 = Math.atan2(off.x, off.z)
    const el0 = Math.asin(MathUtils.clamp(off.y / r, -1, 1))
    const az = az0 + c.az
    const elv = MathUtils.clamp(el0 + c.el, -0.4, 1.2)
    const rr = r * c.zoom
    desired.set(look.x + rr * Math.cos(elv) * Math.sin(az), look.y + rr * Math.sin(elv), look.z + rr * Math.cos(elv) * Math.cos(az))

    if (frozen) base.copy(desired)
    else damp3(base, desired, MathUtils.lerp(1 / LOOK.camera.damp, 0.06, engaged.current), delta)

    // The hover: H = T(pivot + drift) * R * T(-pivot) moves the box; the camera takes H^-1, so the world itself never moves.
    let hx = 0
    let hy = 0
    let bob = 0
    let roll = 0
    if (!frozen) {
      const k = 1 - engaged.current
      damp(hov.current, 'x', pointer.current.x * k, HV.follow, delta)
      damp(hov.current, 'y', pointer.current.y * k, HV.follow, delta)
      hx = hov.current.x
      hy = hov.current.y
      const ts = performance.now() / 1000
      bob = HV.bob * Math.sin((2 * Math.PI * ts) / HV.bobPeriod)
      roll = HV.roll * Math.sin((2 * Math.PI * ts) / HV.rollPeriod + 1.3)
    }
    hEuler.set(-HV.pitch * hy, HV.yaw * hx, roll, 'YXZ')
    hQuat.setFromEuler(hEuler)
    hRot.makeRotationFromQuaternion(hQuat)
    hA.makeTranslation(-PIVOT.x, -PIVOT.y, -PIVOT.z)
    hB.makeTranslation(PIVOT.x + HV.shift[0] * hx, PIVOT.y + HV.shift[1] * hy + bob, PIVOT.z)
    hInv.multiplyMatrices(hB, hRot).multiply(hA).invert()
    camera.position.copy(base).applyMatrix4(hInv)
    lookW.copy(look).applyMatrix4(hInv)
    camera.up.set(0, 1, 0).applyQuaternion(hQuat.invert())
    camera.lookAt(lookW)
  })
  return null
}
