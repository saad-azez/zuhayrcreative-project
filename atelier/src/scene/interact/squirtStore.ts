import { TUBES } from '../../layout'
// Live, interactive squeezes (not part of the pure loop): the tube the visitor is squirting presses in while paint comes out.
// Per tube: the performance.now() (ms) of its last squirt pulse.
export const lastPulse: number[] = TUBES.map(() => -1e9)
/** Extra squeeze for tube i at time now (ms): a quick press that releases over 450 ms. */
export function squirtSqueeze(i: number, now: number): number {
  const d = (now - lastPulse[i]) / 450
  return d < 0 || d > 1 ? 0 : Math.sin(Math.PI * Math.min(1, d * 1.6)) ** 2 * (1 - d * 0.4)
}
