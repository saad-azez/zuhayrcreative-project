import { Suspense, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { NoToneMapping } from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Bloom, DepthOfField, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, type EffectComposer as Composer } from 'postprocessing'
import { LOOK } from './look'
import { LOOP } from './layout'
import { CameraRig } from './CameraRig'
import { Env } from './scene/Env'
// SCENE IMPORTS (the lead wires each module here as it lands)
import { Lights } from './scene/Lights'
import { Room } from './scene/Room'
import { MirrorWall } from './scene/MirrorWall'
import { Turntable } from './scene/Turntable'
import { Tubes } from './scene/tubes/Tubes'
import { Caps } from './scene/tubes/Caps'
import { Puffs } from './scene/tubes/Puffs'
import { Props } from './scene/props'
import { Squirt } from './scene/interact/Squirt'
import { SeasonsRail } from './scene/seasons/SeasonsRail'
import { RegionPaint } from './scene/seasons/RegionPaint'
import { RegionHide } from './scene/seasons/RegionHide'
import { DitherSweep } from './effects/DitherSweep'
import { WallChips } from './scene/WallChips'
import { Pixels, Ropes, ZMark, ScanSheet, Settled, Motes } from './scene/pixels'
import { IS_DEV, a, setAssetBase } from './lib/assets'
import { prepare, type Prepared } from './lib/prepare'
import { pageIsStill, sinceScroll } from './lib/hostScroll'
import { CAPTURE } from './lib/time'
import { BrandSwatches } from './ui/BrandSwatches'

/** Review only: `?fx=0` renders without post-processing. */
const NO_FX = typeof location !== 'undefined' && new URLSearchParams(location.search).get('fx') === '0'

/** Ambient occlusion, a touch of depth of field, a gentle bloom, anti-aliasing and a vignette, with tone mapping applied last. */
function Effects({ composer }: { composer: RefObject<Composer | null> }) {
  return (
    <EffectComposer ref={composer} multisampling={0}>
      <N8AO aoRadius={LOOK.post.aoRadius} intensity={LOOK.post.aoIntensity} halfRes />
      <DepthOfField target={LOOK.dof.target as unknown as [number, number, number]} worldFocusRange={LOOK.dof.range} bokehScale={LOOK.dof.bokeh} />
      <Bloom mipmapBlur intensity={LOOK.post.bloom} luminanceThreshold={LOOK.post.bloomThreshold} />
      <SMAA />
      <DitherSweep />
      <Vignette offset={LOOK.post.vignetteOffset} darkness={LOOK.post.vignetteDarkness} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  )
}

/**
 * Dev only: lets the lead inspect the live scene from an isolated tooling context. Set the attribute
 * <html data-shop-in="...js body..."> ; the body runs with (st, scene, THREE) and the JSON result lands in
 * <html data-shop-out>. DOM attributes are shared across script worlds; window globals are not.
 */
function installDevBridge(st: unknown): () => void {
  const root = document.documentElement
  root.dataset.shopReady = '1'
  const mo = new MutationObserver(async () => {
    const body = root.dataset.shopIn
    if (!body) return
    delete root.dataset.shopIn
    let out: unknown
    try {
      const THREE = await import('three')
      out = await new Function('st', 'scene', 'THREE', body)(st, (st as { scene: unknown }).scene, THREE)
    } catch (err) {
      out = String(err)
    }
    root.dataset.shopOut = JSON.stringify(out)
  })
  mo.observe(root, { attributes: true, attributeFilter: ['data-shop-in'] })
  return () => mo.disconnect()
}

function DevBridge() {
  const st = useThree()
  useEffect(() => installDevBridge(st), [st])
  return null
}

/** Counts rendered frames and says so once, after the third: the moment the poster can give way to the live scene. */
function FirstFrames({ onReady }: { onReady: () => void }) {
  const n = useRef(0)
  useFrame(() => {
    if (n.current >= 3) return
    n.current += 1
    if (n.current === 3) onReady()
  })
  return null
}

/** `?capture=<name>`: on the 90th frame, posts the canvas to the dev server (see vite.config.ts) as the poster source. */
function Capture({ name }: { name: string }) {
  const gl = useThree((s) => s.gl)
  const n = useRef(0)
  useFrame(() => {
    n.current += 1
    if (n.current !== 90) return
    const dataUrl = gl.domElement.toDataURL('image/png')
    fetch('/__poster?name=' + encodeURIComponent(name), { method: 'POST', body: dataUrl })
      .then((r) => { document.documentElement.dataset.captured = r.ok ? '1' : 'error' })
      .catch(() => { document.documentElement.dataset.captured = 'error' })
  })
  return null
}

export type ShopWindowProps = {
  /** Folder (with a trailing slash) holding tex/, hdri/, fonts/ and basis/. */
  assetBase?: string
  /** Landscape poster (jpg); the avif is the same path with `.avif`. */
  poster?: string
  /** Portrait poster (jpg); the avif is the same path with `.avif`. */
  posterPortrait?: string
  /**
   * How far from the screen the window starts to build itself, as an IntersectionObserver rootMargin. One screen by
   * default; a host with a long page above the window can give it more room to be ready by the time it is reached.
   */
  approach?: string
  /**
   * Draw at half rate while the host page is scrolling, and for a moment after. For a window that is one part of a long
   * page with its own motion: the page's scroll is what the reader has their hand on.
   */
  yieldToScroll?: boolean
  className?: string
  style?: CSSProperties
}

const asAvif = (jpg: string) => (/\.[a-z0-9]+$/i.test(jpg) ? jpg.replace(/\.[a-z0-9]+$/i, '.avif') : jpg + '.avif')
const fill: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }
const maxDpr = () => Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)

/**
 * Holds the window's first frame until what that frame would have stopped the page for has been done ahead of it: the
 * shader programs built by the driver in the background, their uniforms looked up and the textures uploaded a few at a
 * time (lib/prepare.ts has the whole of it, and why).
 */
function Prepare({ composer, post, onReady }: { composer: RefObject<Composer | null>; post: boolean; onReady: () => void }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const ready = useRef(onReady)
  ready.current = onReady
  useEffect(() => {
    let cancelled = false
    let done = false
    let made: Prepared | null = null
    const finish = () => {
      if (cancelled || done) return
      done = true
      ready.current()
    }
    prepare({ gl, scene, camera, composer: () => composer.current, post, cancelled: () => cancelled }).then(
      (p) => {
        made = p
        if (cancelled) p.dispose()
        finish()
      },
      finish,
    )
    // Never leave the window dark for a driver that does not answer: draw anyway, the old way.
    const giveUp = window.setTimeout(finish, PREPARE_LIMIT_MS)
    return () => {
      cancelled = true
      window.clearTimeout(giveUp)
      made?.dispose()
    }
  }, [gl, scene, camera, composer, post])
  return null
}
/** How long the first frame waits to be prepared for before it goes ahead regardless. */
const PREPARE_LIMIT_MS = 25000

/** The warm-up's stride through the loop, in loop seconds a step, and the pause between steps. */
const WARM_STRIDE_S = 0.4
const WARM_PAUSE_MS = 60

/** How long a window that is already on screen is kept on its poster for the sake of the warm-up, at most. */
const WARM_ON_SCREEN_MS = 6000

/**
 * Walks the window through one whole loop before it is shown, behind its poster.
 *
 * Prepare covers the programs the scene needs to draw its first frame. A few more are only asked for once things are
 * moving: the voxels are given their colours a second or two in, a region's print is unrolled. Each was built the first
 * time it was needed, with the page stopped for up to a second apiece, at whatever moment of the loop that happened to
 * be, in full view. Stepped through here, in strides of WARM_STRIDE_S with the frame loop off, every moment of the loop
 * is drawn once and what it needs is built then: while the window is still its poster, and only between scrolls of the
 * host page, so a stop lands in a pause. The scene's real first frame (its geometry going to the GPU) is the first of
 * these steps, so that is behind the poster too.
 *
 * Off screen there is no hurry, and the window is ready when it is reached. On screen (a window at the top of a page, or
 * a reader who got here first) it is given WARM_ON_SCREEN_MS and then shown as it is: a poster that never comes to life
 * for someone who will not stop scrolling would be worse than the stops.
 */
function WarmUp({ onScreen, onDone }: { onScreen: boolean; onDone: () => void }) {
  const advance = useThree((s) => s.advance)
  const done = useRef(onDone)
  done.current = onDone
  const seen = useRef(onScreen)
  seen.current = onScreen
  useEffect(() => {
    let t = 0
    let timer = 0
    let since = 0 // when it came on screen still warming
    const step = () => {
      const now = performance.now()
      if (!seen.current) since = 0
      else if (!since) since = now
      else if (now - since > WARM_ON_SCREEN_MS) return done.current()
      if (!document.hidden && pageIsStill()) {
        t += WARM_STRIDE_S
        advance(t)
        if (t > LOOP + WARM_STRIDE_S) return done.current()
      }
      timer = window.setTimeout(step, WARM_PAUSE_MS)
    }
    timer = window.setTimeout(step, WARM_PAUSE_MS)
    return () => window.clearTimeout(timer)
  }, [advance])
  return null
}

/** The window's first seconds are shader compiles and texture uploads: slow frames then say nothing about the machine. */
const SETTLE_MS = 8000
/** How often the half-rate drive takes stock of the display's cadence. */
const PACE_WINDOW_MS = 10000

/**
 * Draws the window, at full rate or at half.
 *
 * The frame loop is "on demand" whenever the window is on screen, and this is what demands: a frame on every refresh of
 * the display, or on every second one. It is done this way round, rather than by switching the loop between "always"
 * and "on demand", because every such switch restarts the scene's clock, and with it the loop the window is playing:
 * a change of rate would have jumped the picture back to its first frame.
 *
 * Half rate is for two cases:
 *  - `half`: the machine cannot draw the window sixty times a second (the pixel ratio has already given way). It draws
 *    it thirty times, evenly, instead of somewhere between the two and never the same twice. The loop is a function of the
 *    clock, so it plays at the same speed.
 *  - `yieldToScroll`: the host page is scrolling. Every second refresh is left to the page, which is what a reader's
 *    hand is on; the window is moving across the screen at that moment and is back at full rate when it stops.
 *
 * It also watches the display's own cadence. At full rate, `onBehind` says when the display is running late (see
 * below, in the loop). While at half rate for the machine's sake, in windows of PACE_WINDOW_MS:
 *  - `onSteady`: two windows running with every refresh on time. Drawing the window is not what was holding the display
 *    back any more (a slow start, another tab), so full rate can be tried again.
 *  - `onTooSlow`: the drawn frames are themselves taking three refreshes or more. Thirty a second is out of reach too,
 *    and a window stuttering at twelve is worse than a still one.
 */
function Drive({ half, yieldToScroll, onSteady, onTooSlow, onBehind }: { half: boolean; yieldToScroll: boolean; onSteady: () => void; onTooSlow: () => void; onBehind: () => void }) {
  const invalidate = useThree((s) => s.invalidate)
  const p = useRef({ half, yieldToScroll, onSteady, onTooSlow, onBehind })
  p.current = { half, yieldToScroll, onSteady, onTooSlow, onBehind }
  useEffect(() => {
    let raf = 0
    let odd = false
    let last = performance.now()
    let since = last
    let seen = 0
    let late = 0 // refreshes that missed their slot
    let slow = 0 // refreshes that took three slots or more
    let clean = 0 // windows in a row with nothing late
    const tick = (now: number) => {
      const dt = now - last
      last = now
      const { half, yieldToScroll } = p.current
      if (half) {
        seen += 1
        if (dt > 21) late += 1
        if (dt > 45) slow += 1
        if (now - since > PACE_WINDOW_MS) {
          // Every second refresh is a drawn one, so "half of them slow" is all of the drawn ones.
          if (slow > seen * 0.35) p.current.onTooSlow()
          clean = late <= seen * 0.05 ? clean + 1 : 0
          if (clean >= 2) {
            clean = 0
            p.current.onSteady()
          }
          since = now
          seen = late = slow = 0
        }
      } else if (sinceScroll() > 1000 && !document.hidden) {
        // At full rate, the same watch the other way: a quarter of the refreshes late, two windows running, and the
        // display is being held back. The library's own monitor only speaks below 40 frames a second; between 40 and 60
        // is exactly where a page feels slow and nothing was said. (Not counted around a scroll, when half the frames are
        // the page's on purpose and whatever is late is not the window's doing.)
        seen += 1
        if (dt > 21) late += 1
        if (now - since > BEHIND_WINDOW_MS) {
          clean = late > seen * 0.25 ? clean + 1 : 0
          if (clean >= 2) {
            clean = 0
            p.current.onBehind()
          }
          since = now
          seen = late = slow = 0
        }
      } else {
        since = now
        seen = late = slow = 0
      }
      odd = !odd
      if (odd || !(half || (yieldToScroll && sinceScroll() < SCROLL_YIELD_MS))) invalidate()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [invalidate])
  return null
}
/** How long after the page's last scroll event the window stays at half rate. */
const SCROLL_YIELD_MS = 180
/** The stretch over which a full-rate window is judged to be holding the display back. */
const BEHIND_WINDOW_MS = 4000

/**
 * The Zuhayr Creative window ("Paint to Pixel") as one embeddable section. A pre-rendered poster shows at once; the 3D mounts when the
 * section is within a viewport of the screen, cross-fades in after its third frame, and sleeps off-screen.
 */
export function ShopWindow(props: ShopWindowProps) {
  if (props.assetBase) setAssetBase(props.assetBase)
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(CAPTURE !== null)
  const [onScreen, setOnScreen] = useState(false)
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  const [live, setLive] = useState(false)
  const [dpr, setDpr] = useState(() => maxDpr())
  // Under load the pixel ratio gives way first. Once it is at 1 and the window still cannot keep up, the frame rate does
  // (Drive); and a machine that cannot manage half rate either is left on the poster, which is this same window, still.
  const [half, setHalf] = useState(false)
  const [still, setStill] = useState(false)
  const probed = useRef(false)
  const liveAt = useRef(0)
  // Nothing is drawn until the shaders are in (Prepare): the first frame would otherwise stop the page to build them.
  const [compiled, setCompiled] = useState(CAPTURE !== null)
  const composer = useRef<Composer | null>(null)
  // ...and until it has been walked once through its loop behind its poster (WarmUp), on screen or off it.
  const [warmed, setWarmed] = useState(CAPTURE !== null)
  const warming = compiled && !warmed && !still && !hidden
  const drawing = onScreen && !hidden && !still && compiled && warmed
  useEffect(() => {
    // The frames that count for pacing are the ones on screen: start the settling period from here.
    if (drawing) liveAt.current = performance.now()
  }, [drawing])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Mount once the section is within a viewport of the screen (and never unmount again).
    const nearObs = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setNear(true) }, { rootMargin: props.approach ?? '100% 0px 100% 0px' })
    // Render only while any of it is actually on screen.
    const screenObs = new IntersectionObserver((es) => { for (const e of es) setOnScreen(e.isIntersecting) }, { rootMargin: '0px', threshold: 0 })
    nearObs.observe(el)
    screenObs.observe(el)
    const onVis = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      nearObs.disconnect()
      screenObs.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const poster = props.poster ?? a('poster.jpg')
  const posterPortrait = props.posterPortrait ?? a('poster-portrait.jpg')
  const avif = props.poster ? asAvif(props.poster) : a('poster.avif')
  const avifPortrait = props.posterPortrait ? asAvif(props.posterPortrait) : a('poster-portrait.avif')

  return (
    <div
      ref={ref}
      className={props.className}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: LOOK.bg, ...props.style }}
    >
      {CAPTURE === null && (
        <picture>
          <source media="(orientation: portrait)" type="image/avif" srcSet={avifPortrait} />
          <source media="(orientation: portrait)" srcSet={posterPortrait} />
          <source type="image/avif" srcSet={avif} />
          <img src={poster} alt="" aria-hidden draggable={false} style={fill} />
        </picture>
      )}
      {(near || CAPTURE !== null) && (
        <div style={{ position: 'absolute', inset: 0, opacity: (live && !still && !warming) || CAPTURE !== null ? 1 : 0, transition: 'opacity 700ms ease' }}>
          <Canvas
            shadows
            dpr={CAPTURE !== null ? 1 : dpr}
            // On demand while it is on screen: Drive asks for the frames, at full rate or half.
            frameloop={CAPTURE !== null ? 'always' : drawing ? 'demand' : 'never'}
            gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: NoToneMapping, preserveDrawingBuffer: CAPTURE !== null }}
            camera={{ fov: LOOK.camera.fov, near: 0.1, far: 60, position: [...LOOK.camera.pos] }}
            onCreated={({ gl }) => { gl.localClippingEnabled = true }}
          >
            <color attach="background" args={[LOOK.bg]} />
            {CAPTURE === null && (
              // Under load the pixel ratio gives way, then the frame rate (see Drive); never a quality setting.
              <PerformanceMonitor
                onDecline={() => {
                  // Not while it is being stepped through off screen, nor in its first seconds on it.
                  if (!drawing || !liveAt.current || performance.now() - liveAt.current < SETTLE_MS) return
                  // Nor on the evidence of a scroll, when it was drawing at half rate on purpose.
                  if (props.yieldToScroll && sinceScroll() < 3000) return
                  if (dpr > 1) setDpr((d) => Math.max(1, d - 0.5))
                  else setHalf(true)
                }}
                onIncline={() => setDpr((d) => Math.min(maxDpr(), d + 0.5))}
              />
            )}
            {CAPTURE === null && drawing && (
              <Drive
                half={half}
                yieldToScroll={props.yieldToScroll === true}
                onSteady={() => {
                  // One try at full rate. If the window falls behind again it is half rate for good.
                  if (probed.current) return
                  probed.current = true
                  setHalf(false)
                }}
                onTooSlow={() => setStill(true)}
                onBehind={() => {
                  // The same rule as the monitor's: not in the first seconds on screen.
                  if (liveAt.current && performance.now() - liveAt.current > SETTLE_MS) setHalf(true)
                }}
              />
            )}
            <Suspense fallback={null}>
              <Env />
              {/* SCENE (the lead wires each module here as it lands) */}
              <Lights />
              <Room />
              <MirrorWall />
              <Turntable />
              <Tubes />
              <Caps />
              <WallChips />
              <RegionHide>
                <Pixels />
                <Ropes />
                <ZMark />
                <ScanSheet />
                <Puffs />
              </RegionHide>
              <Settled />
              <Motes />
              <Props />
              <SeasonsRail />
              <RegionPaint />
              <Squirt />
              <CameraRig containerRef={ref} />
              {CAPTURE === null && <Prepare composer={composer} post={!NO_FX} onReady={() => setCompiled(true)} />}
              {warming && <WarmUp onScreen={onScreen} onDone={() => setWarmed(true)} />}
              {!NO_FX && <Effects composer={composer} />}
              {CAPTURE !== null && <Capture name={CAPTURE} />}
              <FirstFrames
                onReady={() => {
                  liveAt.current = performance.now()
                  setLive(true)
                }}
              />
            </Suspense>
            {IS_DEV && <DevBridge />}
          </Canvas>
        </div>
      )}
      {CAPTURE === null && <BrandSwatches />}
    </div>
  )
}
