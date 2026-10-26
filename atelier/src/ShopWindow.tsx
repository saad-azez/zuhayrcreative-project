import { Suspense, useEffect, useRef, useState, type CSSProperties } from 'react'
import { NoToneMapping } from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Bloom, DepthOfField, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { LOOK } from './look'
import { CameraRig } from './CameraRig'
import { Env } from './scene/Env'
import { RenderBudget } from './scene/RenderBudget'
import { Optional } from './lib/Optional'
import { StaticBatch } from './lib/StaticBatch'
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
import { IS_DEV, IS_PHONE, a, setAssetBase } from './lib/assets'
import { ShopPreload } from './lib/Preload'
import { CAPTURE } from './lib/time'
import { BrandSwatches } from './ui/BrandSwatches'

/** Review only: `?fx=0` renders without post-processing. */
const NO_FX = typeof location !== 'undefined' && new URLSearchParams(location.search).get('fx') === '0'

/** Ambient occlusion, a touch of depth of field, a gentle bloom, anti-aliasing and a vignette, with tone mapping applied last. */
function Effects() {
  return (
    <EffectComposer multisampling={0}>
      {/* A phone leaves out the two costliest passes, the ambient occlusion and the depth of field (IS_PHONE). */}
      {!IS_PHONE && <N8AO aoRadius={LOOK.post.aoRadius} intensity={LOOK.post.aoIntensity} halfRes />}
      {!IS_PHONE && <DepthOfField target={LOOK.dof.target as unknown as [number, number, number]} worldFocusRange={LOOK.dof.range} bokehScale={LOOK.dof.bokeh} />}
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

/**
 * Counts rendered frames and says so once, after the third: the moment the poster can give way to the live scene. The first
 * frames are slow (shaders compile, textures upload), so the clock restarts here: the loop's first visible moment is exactly
 * the poster moment, and its motion starts as the cross-fade starts instead of having been spent behind the poster.
 */
function FirstFrames({ onReady }: { onReady: () => void }) {
  const n = useRef(0)
  useFrame((state) => {
    if (n.current >= 3) return
    n.current += 1
    // Marks for the load timeline (DevTools Performance / performance.getEntriesByType('mark')); free in production.
    performance.mark('shop-frame-' + n.current)
    if (n.current === 3) {
      state.clock.start()
      onReady()
    }
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
  className?: string
  style?: CSSProperties
}

const asAvif = (jpg: string) => (/\.[a-z0-9]+$/i.test(jpg) ? jpg.replace(/\.[a-z0-9]+$/i, '.avif') : jpg + '.avif')
const fill: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }
// A phone draws at up to 1.5x its CSS pixels (its screen is 3x; the window is small on it).
const maxDpr = () => Math.min(IS_PHONE ? 1.5 : 2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)

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

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Mount once the section is within a viewport of the screen (and never unmount again).
    const nearObs = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setNear(true) }, { rootMargin: '100% 0px 100% 0px' })
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
        <div style={{ position: 'absolute', inset: 0, opacity: live || CAPTURE !== null ? 1 : 0, transition: 'opacity 700ms ease' }}>
          <Canvas
            shadows
            dpr={CAPTURE !== null ? 1 : dpr}
            frameloop={CAPTURE !== null || (onScreen && !hidden) ? 'always' : 'never'}
            gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: NoToneMapping, preserveDrawingBuffer: CAPTURE !== null }}
            camera={{ fov: LOOK.camera.fov, near: 0.1, far: 60, position: [...LOOK.camera.pos] }}
            onCreated={({ gl }) => { gl.localClippingEnabled = true }}
          >
            <color attach="background" args={[LOOK.bg]} />
            {CAPTURE === null && (
              // Only the pixel ratio ever gives way under load, never a quality setting.
              <PerformanceMonitor
                onDecline={() => setDpr((d) => Math.max(1, d - 0.5))}
                onIncline={() => setDpr((d) => Math.min(maxDpr(), d + 0.5))}
              />
            )}
            <Suspense fallback={null}>
              <ShopPreload />
              <RenderBudget />
              <Env />
              {/* SCENE (the lead wires each module here as it lands) */}
              <Optional name="Lights"><StaticBatch><Lights /></StaticBatch></Optional>
              <Optional name="Room"><StaticBatch><Room /></StaticBatch></Optional>
              <Optional name="MirrorWall"><StaticBatch><MirrorWall /></StaticBatch></Optional>
              <Optional name="Turntable"><Turntable /></Optional>
              <Optional name="Tubes"><Tubes /></Optional>
              <Optional name="Caps"><Caps /></Optional>
              <Optional name="WallChips"><WallChips /></Optional>
              <Optional name="pixels">
              <RegionHide>
                <Pixels />
                <Ropes />
                <ZMark />
                <ScanSheet />
                <Puffs />
              </RegionHide>
              </Optional>
              <Optional name="Settled"><Settled /></Optional>
              <Optional name="Motes"><Motes /></Optional>
              <Optional name="Props"><Props /></Optional>
              <Optional name="SeasonsRail"><SeasonsRail /></Optional>
              <Optional name="RegionPaint"><RegionPaint /></Optional>
              <Optional name="Squirt"><Squirt /></Optional>
              <CameraRig containerRef={ref} />
              {!NO_FX && <Effects />}
              {CAPTURE !== null && <Capture name={CAPTURE} />}
              <FirstFrames onReady={() => setLive(true)} />
            </Suspense>
            {IS_DEV && <DevBridge />}
          </Canvas>
        </div>
      )}
      {CAPTURE === null && <BrandSwatches />}
    </div>
  )
}
