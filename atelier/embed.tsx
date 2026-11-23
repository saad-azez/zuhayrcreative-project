// The site's way in (model draft): the atelier window as a self-contained module, React and three inside it, mounted
// into an element of the host page's. Built by `npm run build:lib` into ../public/atelier/atelier-window.js.
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { clear as clearLoaderCache } from 'suspend-react'
import { Cache } from 'three'
import { KTX2Loader } from 'three-stdlib'
import { KTX2Loader as ThreeKTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { terminateWorker } from 'troika-worker-utils'
import { ShopWindow, type ShopWindowProps } from './src/ShopWindow'

export type { ShopWindowProps }

// The window's worker heaps (each a WebAssembly or JS heap held while its worker lives), stopped on the way out in ways
// each library recovers from, so the next opening (same module, AtelierWindow loads it once) still works:
// - KTX2 transcoders. Two loader classes are bundled, three-stdlib's and three's own; R3F keeps every loader for the
//   life of the page. Their pools' dispose() ends the workers and the pool makes new ones on demand.
// - troika's text workers: terminateWorker() ends one and it is respawned on the next call.
type Pooled = { workerPool?: { dispose(): void } }
const ktx2Loaders = new Set<Pooled>()
for (const L of [KTX2Loader, ThreeKTX2Loader] as unknown as { prototype: { detectSupport(...a: unknown[]): unknown } }[]) {
  const detect = L.prototype.detectSupport
  L.prototype.detectSupport = function (this: Pooled, ...args: unknown[]) {
    ktx2Loaders.add(this)
    return detect.apply(this, args)
  }
}
const TROIKA_WORKERS = ['#default', ...[0, 1, 2, 3].map((i) => 'TroikaTextSDFGenerator_JS_' + i)]
function stopWorkers() {
  for (const loader of ktx2Loaders) {
    try {
      // The pool only: the loader's own dispose() would also revoke the worker script the pool needs to start again.
      loader.workerPool?.dispose()
    } catch {
      /* nothing to stop */
    }
  }
  for (const id of TROIKA_WORKERS) {
    try {
      terminateWorker(id)
    } catch {
      /* not started */
    }
  }
}
let live = 0

// Every GPU object the window's WebGL contexts make, so each can be deleted on the way out. Safari's loseContext() is a
// simulated loss that keeps the context restorable, and with it its textures: measured on the client's iPhone 12 (23 Nov)
// the closed window still held about a gigabyte, the page was rebuilt on top and iOS killed the tab one second after
// Close. Deleting them is what hands the memory back.
type GL = WebGLRenderingContext | WebGL2RenderingContext
const KINDS = ['Texture', 'Buffer', 'Framebuffer', 'Renderbuffer', 'Program', 'Shader', 'VertexArray', 'Query', 'Sampler'] as const
const made = new Map<GL, Map<string, Set<unknown>>>()
const hosts = new Set<HTMLElement>()
function track(gl: GL) {
  if (made.has(gl)) return
  const byKind = new Map<string, Set<unknown>>()
  made.set(gl, byKind)
  const g = gl as unknown as Record<string, (...a: unknown[]) => unknown>
  for (const kind of KINDS) {
    const create = g['create' + kind]
    const del = g['delete' + kind]
    if (typeof create !== 'function' || typeof del !== 'function') continue
    const set = new Set<unknown>()
    byKind.set(kind, set)
    g['create' + kind] = function (this: unknown, ...a: unknown[]) {
      const o = create.apply(gl, a)
      if (o) set.add(o)
      return o
    }
    g['delete' + kind] = function (this: unknown, o: unknown) {
      set.delete(o)
      return del.call(gl, o)
    }
  }
}
const getContext = HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: unknown[]) {
  const ctx = (getContext as (...a: unknown[]) => unknown).apply(this, args)
  // The window's own scene canvases, inside its element. Not the host page's, and not offscreen helpers such as
  // troika's text canvas, which its module keeps and reuses for every opening.
  const ours = [...hosts].some((h) => h.contains(this))
  if (live > 0 && ours && (args[0] === 'webgl2' || args[0] === 'webgl' || args[0] === 'experimental-webgl') && ctx)
    track(ctx as GL)
  return ctx
} as typeof getContext
function freeGpu(gl: GL) {
  const byKind = made.get(gl)
  made.delete(gl)
  if (!byKind || gl.isContextLost()) return
  try {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)
  } catch {
    /* nothing bound */
  }
  for (const kind of KINDS) {
    const set = byKind.get(kind)
    if (!set) continue
    const del = (gl as unknown as Record<string, (o: unknown) => void>)['delete' + kind]
    for (const o of set) {
      try {
        del.call(gl, o)
      } catch {
        /* already gone */
      }
    }
    set.clear()
  }
}

/** Renders the window filling `el` (size and place that element yourself) and hands back the way to take it down. */
export function mountAtelier(el: HTMLElement, props: ShopWindowProps = {}) {
  live += 1
  hosts.add(el)
  const root = createRoot(el)
  root.render(createElement(ShopWindow, props))
  return {
    /**
     * Unmounts the scene and frees its memory, all of it and at once.
     *
     * Unmounting alone left most of it held (measured on the client's iPhone 12, 23 Nov): R3F gives the context back
     * through deferred React callbacks, and the loader cache keeps every texture (and its compressed mip data) for the
     * life of the page. The page is rebuilt behind the window as it closes, so for a moment both were in memory, iOS
     * sent critical memory warnings twice and the tab froze and reloaded. So: the context goes first, synchronously,
     * which frees the GPU side now; then the tree; then the cached textures and the transcoder workers.
     */
    destroy() {
      const canvas = el.querySelector('canvas')
      const gl = canvas
        ? ((canvas.getContext('webgl2') as WebGL2RenderingContext | null) ??
          (canvas.getContext('webgl') as WebGLRenderingContext | null))
        : null
      root.unmount()
      // Every scene context the window made, not only the one still in the element.
      for (const g of [...made.keys()]) freeGpu(g)
      if (canvas) {
        // The drawing buffers (colour, depth, multisample) go with the size.
        canvas.width = 1
        canvas.height = 1
      }
      try {
        gl?.getExtension('WEBGL_lose_context')?.loseContext()
      } catch {
        /* already gone */
      }
      clearLoaderCache()
      Cache.clear()
      hosts.delete(el)
      live = Math.max(0, live - 1)
      if (live === 0) stopWorkers()
    },
  }
}
