/**
 * The register of home-page sections that LazyHydrate is holding back, and
 * the one way to wake them all: a nav jump or a deep link needs the page at
 * its final height before anything scrolls to a position in it.
 *
 * Kept apart from LazyHydrate so the scroll provider can import it without a
 * cycle (LazyHydrate uses the provider's context).
 */

/** Sections still dormant, each a function that mounts it and resolves once it has settled. */
const dormant = new Set<() => Promise<void>>();
/** Mounts in flight, dormant or not (a deep link mounts without ever being dormant). */
const inFlight = new Set<Promise<void>>();

/** How long a caller will wait for the sections it woke before going ahead regardless. */
export const WAKE_WAIT_MS = 1500;

export function registerDormant(mount: () => Promise<void>) {
  dormant.add(mount);
  return () => {
    dormant.delete(mount);
  };
}

export function trackMount(p: Promise<void>) {
  inFlight.add(p);
  p.finally(() => inFlight.delete(p)).catch(() => undefined);
}

export function hasDormantSections() {
  return dormant.size > 0;
}

/**
 * Mount every dormant section now. Resolves once all of them (and any mount
 * already under way) have settled — or after `bound` ms, whichever is first,
 * so a chunk that will not arrive cannot hold a nav click hostage.
 */
export function mountAllSections(bound = WAKE_WAIT_MS): Promise<void> {
  for (const mount of Array.from(dormant)) {
    dormant.delete(mount);
    void mount();
  }
  if (inFlight.size === 0) return Promise.resolve();
  const all = Promise.all(Array.from(inFlight)).then(() => undefined);
  const timer = new Promise<void>((r) => window.setTimeout(r, bound));
  return Promise.race([all, timer]);
}
