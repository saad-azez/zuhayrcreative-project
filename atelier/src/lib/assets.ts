import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useKTX2 } from '@react-three/drei'
import { NoColorSpace, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

// Next.js has no import.meta.env, so the base can also be set at runtime (ShopWindow's `assetBase` prop).
const env = (import.meta as { env?: { BASE_URL?: string; DEV?: boolean } }).env
let base: string = env?.BASE_URL ?? '/shop/'
export const IS_DEV = env?.DEV === true
/** Sets the folder the KTX2 / HDR / font assets are served from; always stored with a trailing `/`. */
export function setAssetBase(b: string) { base = b.endsWith('/') ? b : b + '/' }
export const a = (p: string) => base + p
/** Bumped whenever the encoded textures change, so browsers and CDNs never serve a stale copy. */
export const TEX_VERSION = '7'
/** A phone: a coarse pointer on a small screen. It gets a lighter frame (ShopWindow; 24 Oct, the user: the window on phones). */
export const IS_PHONE =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches &&
  Math.min(window.screen.width, window.screen.height) < 820
/** A touch device, phone or tablet: its primary pointer is coarse. */
const IS_TOUCH =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
/**
 * The texture folder for this device: computers the full 4K set (221 MB), phones and tablets the 2K one (79 MB,
 * atelier/tools/make-2k-textures.py; 7 Nov, the user). `?tex=4k`, `?tex=2k` or `?tex=m` in the page's address picks one by
 * hand, to put two side by side.
 */
const ASKED =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tex') : null
export const TEX_DIR = ASKED === '4k' || ASKED === '2k' || ASKED === 'm' ? ASKED : IS_TOUCH ? '2k' : '4k'
/** A canvas bake (scripts/encode-bakes.sh: UASTC level 4, no RDO, zstd, at the canvas's exact size, y-flipped). */
export const bakeUrl = (name: string) => a(`tex/${TEX_DIR}/${name}.ktx2?v=${TEX_VERSION}`)
const tex = (id: string, k: string) => a(`tex/${TEX_DIR}/${id}_${k}.ktx2?v=${TEX_VERSION}`)
/** The exact URL list usePBR loads for a scan; ShopPreload asks for the same list so both share one cache entry. */
export const pbrUrls = (id: string, withColor: boolean) =>
  (withColor ? (['color', 'normal', 'rough'] as const) : (['normal', 'rough'] as const)).map((k) => tex(id, k))

/** On a computer every scan is loaded as its full-resolution 4K KTX2 (public/tex/4k, never downscaled); the poster covers the load. */

type PBR = { map?: Texture; normalMap: Texture; roughnessMap: Texture }

/**
 * Loads one scan's colour / normal / roughness set and prepares it for world-space tiling.
 * `color: false` skips the colour map (metals that are tinted and only use the brushed normal/roughness).
 */
export function usePBR(id: string, opts: { color?: boolean } = {}): PBR {
  const withColor = opts.color !== false
  const gl = useThree((s) => s.gl)
  const set = useKTX2(pbrUrls(id, withColor), a('basis/')) as Texture[]

  return useMemo(() => {
    const aniso = gl.capabilities.getMaxAnisotropy()
    set.forEach((t, i) => {
      t.wrapS = t.wrapT = RepeatWrapping
      t.anisotropy = aniso
      t.colorSpace = withColor && i === 0 ? SRGBColorSpace : NoColorSpace
      t.needsUpdate = true
    })
    return withColor
      ? { map: set[0], normalMap: set[1], roughnessMap: set[2] }
      : { normalMap: set[0], roughnessMap: set[1] }
  }, [gl, set, withColor])
}
