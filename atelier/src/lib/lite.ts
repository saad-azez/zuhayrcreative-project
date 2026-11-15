import type { Material } from 'three'

/**
 * Review only, for judging live before anything is adopted: `?lite=refl,shadow,glass` makes the window lighter in ways that
 * change a pixel here and there.
 *   refl    each reflection (the mirror wall, the marble floor) is redrawn every other frame, the two on alternate frames;
 *           in between it shows the one it drew last.
 *   shadow  the shadow maps are redrawn every other frame.
 *   glass   the frosted glass refracts only in the main view; in the reflections it is drawn without refraction.
 */
export const LITE: ReadonlySet<string> = new Set(
  (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lite') ?? '' : '').split(',').filter(Boolean),
)

/** `&every=N` (2 to 8, default 2): under `refl` and `shadow`, redraw only every Nth frame instead of every other one. */
export const EVERY: number = Math.min(8, Math.max(2, Math.round(
  Number(typeof location !== 'undefined' ? new URLSearchParams(location.search).get('every') : NaN) || 2,
)))

/** The glass materials (props/Archive.tsx), switched to plain frosted for the reflections under `lite=glass`. */
export const GLASS = new Set<Material & { transmission: number }>()
