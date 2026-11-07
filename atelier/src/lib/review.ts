/**
 * Review only: `?off=ao,dof,bloom,smaa,dither,floor,mirror,shadows,dpr,glass` leaves those parts out (dpr: draws at 1x), so what each
 * costs a frame can be measured. Without it nothing changes.
 */
export const OFF: ReadonlySet<string> = new Set(
  (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('off') ?? '' : '').split(',').filter(Boolean),
)

/** Review only (`?off=expose`): the live scene on window.__atelier, for counting what it draws. */
export const EXPOSE = OFF.has('expose')
