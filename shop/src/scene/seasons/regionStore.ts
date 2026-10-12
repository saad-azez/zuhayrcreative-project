import type { RegionId } from './regions'
// Which region logo the tubes are painting (interactive, outside the pure loop). since = performance.now() ms at the click.
export const region = { id: null as RegionId | null, since: 0 }
/** Seconds the current region paint has run, or -1 when none. */
export const regionAge = () => (region.id ? (performance.now() - region.since) / 1000 : -1)
export const REGION_DUR = 9.2 // the whole paint: build, render, hold, unrender, return
export const regionActive = () => { const a = regionAge(); return a >= 0 && a < REGION_DUR }
export function startRegion(id: RegionId) { region.id = id; region.since = performance.now() }
