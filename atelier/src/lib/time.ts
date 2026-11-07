import { LOOP, TL } from '../layout'

const params = typeof location === 'undefined' ? null : new URLSearchParams(location.search)
/** `?capture=<name>` renders the poster frame, frozen, and posts it to the dev server as assets-src/poster/<name>.png. */
export const CAPTURE: string | null = params?.get('capture') ?? null
/** prefers-reduced-motion: nothing moves; the window shows the poster moment. */
export const STILL: boolean = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
/** `?t=<seconds>` pins the loop at that moment (review). */
export const FIXED_T: number | null = (() => {
  const r = params?.get('t')
  if (r == null) return null
  const n = Number(r)
  return Number.isFinite(n) ? ((n % LOOP) + LOOP) % LOOP : null
})()
/** True when the loop does not run (capture, reduced motion or a pinned review moment). */
export const FROZEN: boolean = CAPTURE !== null || STILL || FIXED_T !== null
/** Loop time in seconds for a clock reading. The live loop starts on the poster frame, so poster and first frame match. */
export const loopT = (elapsed: number): number =>
  FIXED_T ?? (CAPTURE !== null || STILL ? TL.poster : (elapsed + TL.poster) % LOOP)
/** Free-running seconds for ambient motion (motes, the rope's flow): frozen at 0 for a capture or reduced motion. */
export const ambientT = (elapsed: number): number => (CAPTURE !== null || STILL ? 0 : elapsed)
