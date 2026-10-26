import type { RegionId } from './regions'
import { FROZEN } from '../../lib/time'
// Which region logo the tubes are painting (interactive, outside the pure loop). since = performance.now() ms at the click.
export const region = { id: null as RegionId | null, since: 0 }
/** Seconds the current region paint has run, or -1 when none. */
export const regionAge = () => (region.id ? (performance.now() - region.since) / 1000 : -1)
export const REGION_DUR = 9.2 // the whole paint: build, render, hold, unrender, return
/** Never while frozen (capture / reduced motion / a pinned review moment): there the Z loop always shows. */
export const regionActive = () => { if (FROZEN) return false; const a = regionAge(); return a >= 0 && a < REGION_DUR }
/** Ungated 17 Oct: tested live, the pixels fly in, the scan renders the true logo, the tag swings in and it all returns. */
export const REGION_PAINT_ENABLED = true
/** A click on a scarf starts its region's paint; ignored while frozen or while a paint is already running. */
export function startRegion(id: RegionId) {
  if (!REGION_PAINT_ENABLED || FROZEN || regionActive()) return
  region.id = id
  region.since = performance.now()
}
