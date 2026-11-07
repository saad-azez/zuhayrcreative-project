import { useSyncExternalStore } from 'react'
// A tiny shared store for the window's HTML overlays (the 3D scene opens them, ShopWindow renders them).
export type UIState = { swatches: boolean }
let state: UIState = { swatches: false }
const subs = new Set<() => void>()
export const ui = {
  get: () => state,
  set(patch: Partial<UIState>) { state = { ...state, ...patch }; subs.forEach((f) => f()) },
  sub(f: () => void) { subs.add(f); return () => { subs.delete(f) } },
}
export const useUI = () => useSyncExternalStore(ui.sub, ui.get, ui.get)
