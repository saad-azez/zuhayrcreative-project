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
export const TEX_VERSION = '6'
/**
 * Where the scans and the tube prints are loaded from: the 2K set, which is the 4K files with their top mip level taken off
 * and nothing re-encoded (tools/optimize-textures.mjs; README.md has the measurements). The wall drawing stays 4K (Room.tsx).
 */
const TEX_DIR = 'tex/2k/'
/**
 * The light set, for a phone (ShopWindow's `lite` prop): every scan and print at 1K, 15 MB where the full set is 45. On a
 * screen that size the 2K maps are never sampled at their top level anyway, and a phone has the least memory to hold them
 * in and, often, a metered connection to fetch them over. Set once, before the scene mounts.
 */
let lite = false
export function setLite(on: boolean) { lite = on }
/** The folder a scan or print is loaded from, for the set in use. */
export const texDir = () => (lite ? 'tex/1k/' : TEX_DIR)
/**
 * The maps for which even 2K is more than any view can show, loaded at 1K (the same files with two levels taken off): the
 * wood of the pencils and brush handles, which are a few centimetres on screen, and roughness maps, which only shape a
 * highlight. Measured like the 2K set; the colour and normal maps of everything large stay at 2K.
 */
const AT_1K = new Set(['ash_veneer_color', 'ash_veneer_normal', 'ash_veneer_rough', 'Marble003_rough', 'Metal032_rough', 'Foil003_rough', 'Paper001_rough'])
const tex = (id: string, k: string) => a(`${AT_1K.has(`${id}_${k}`) ? 'tex/1k/' : texDir()}${id}_${k}.ktx2?v=${TEX_VERSION}`)

type PBR = { map?: Texture; normalMap: Texture; roughnessMap: Texture }

/**
 * Loads one scan's colour / normal / roughness set and prepares it for world-space tiling.
 * `color: false` skips the colour map (metals that are tinted and only use the brushed normal/roughness).
 */
export function usePBR(id: string, opts: { color?: boolean } = {}): PBR {
  const withColor = opts.color !== false
  const gl = useThree((s) => s.gl)
  const keys = withColor ? (['color', 'normal', 'rough'] as const) : (['normal', 'rough'] as const)
  const set = useKTX2(keys.map((k) => tex(id, k)), a('basis/')) as Texture[]

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
