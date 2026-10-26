import { useMemo } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { KTX2Loader } from 'three-stdlib'
import { a, bakeUrl, pbrUrls } from './assets'
import { inkUrl } from '../scene/Room'
import { labelUrls, printUrls } from '../scene/tubes/Tubes'
import { bannerUrls } from '../scene/seasons/SeasonsRail'

/**
 * Starts every texture the window needs at once, the moment the canvas exists.
 *
 * Without it the loads ran as a waterfall: a component asks for its first texture, suspends, and only asks for its next one
 * (or lets the next component render) once that has downloaded and transcoded, so the tube labels did not even start until
 * ~2 s in. Each call here uses the exact URL list its hook uses (same loader, same order), so the hook later finds the
 * finished texture in R3F's cache; nothing is loaded twice and nothing about the textures changes.
 *
 * Rendered first inside the Suspense, before anything that suspends.
 */
const TRANSCODE_WORKERS = Math.max(4, Math.min(8, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4) - 2))

export function ShopPreload() {
  const gl = useThree((s) => s.gl)
  useMemo(() => {
    // The same set-up drei's useKTX2 applies to the shared loader.
    const ext = (l: KTX2Loader) => {
      // Transcoding the 36 4K maps is the long pole of the load, not the download: give it more of the machine's cores
      // than the loader's default 4 (the work and its output are unchanged).
      l.setWorkerLimit(TRANSCODE_WORKERS)
      l.detectSupport(gl)
      l.setTranscoderPath(a('basis/'))
    }
    const sets: string[][] = [
      pbrUrls('Marble016', true),
      pbrUrls('Metal032', false),
      pbrUrls('Paper001', true),
      pbrUrls('Marble003', true),
      pbrUrls('ash_veneer', true),
      pbrUrls('Foil003', false),
      [inkUrl()],
      printUrls(),
      [bakeUrl('bake_mat')],
      [bakeUrl('bake_deck')],
      labelUrls(),
      bannerUrls(),
    ]
    // useLoader keys a load by [loader, ...urls], so a one-URL list matches a hook given that URL alone.
    for (const s of sets) useLoader.preload(KTX2Loader, s, ext as never)
  }, [gl])
  return null
}
