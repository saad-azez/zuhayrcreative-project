"use client";

/**
 * WebGL context budget — census and reaper.
 *
 * ── The problem this exists for ──
 * Browsers cap the number of live WebGL contexts per page (Chrome: 16) and
 * enforce it by force-losing the OLDEST ones. This page asks for 19. Measured
 * on a production build, scrolled to the bottom:
 *
 *   19 canvases take a WebGL context
 *    9 of them are STILL DETACHED sixteen seconds later
 *    7 of those still hold a live context
 *
 * They are capability probes: a library makes a bare `document.createElement
 * ("canvas")`, asks it for a context to read some limit or test an extension,
 * and drops the reference — but a dropped reference is not a released context.
 * It sits at its default 300x150, invisible, holding one of sixteen slots
 * until garbage collection eventually gets to it, which may be never.
 *
 * Every Unicorn scene is preceded by one of these from the SDK's own call
 * site, so the four scenes alone cost eight slots instead of four. With seven
 * gone to probes, roughly ten real canvases compete for nine places, and the
 * browser starts killing whatever is oldest. That is why the footer background
 * is intermittent: which canvas gets sacrificed depends on the order the
 * scenes happen to boot in, and that order shifts from load to load (the
 * footer scene has been observed as both the 15th and the 19th context on the
 * same build). Phones cap lower than 16, which is why the client sees it more.
 *
 * ── The fix ──
 * Reclaim the probes. A canvas that took a WebGL context, has never been put
 * in the document, and is still sitting at the default 300x150 several seconds
 * later is finished with — nothing can draw it, because nothing can see it.
 * `WEBGL_lose_context.loseContext()` releases its slot immediately and
 * deterministically, rather than waiting on the GC.
 *
 * The test is deliberately narrow, because the cost of being wrong is a
 * library finding its context gone:
 *   - never connected to the document, checked repeatedly, not once;
 *   - still at exactly the default size — any renderer doing real work sizes
 *     its canvas, so a resized canvas is never touched (this is what protects
 *     the 512x512 one, which is deliberately sized and may be a texture
 *     source);
 *   - given REAP_AFTER_MS to be inserted first, which is orders of magnitude
 *     longer than the gap between `createElement` and `appendChild` in any
 *     real mounting path.
 */


/** The size a canvas has before anyone sets one. A probe never leaves it. */
/* ms since this module loaded: the age stamp the reaper sorts by. */
const t0 = typeof performance !== "undefined" ? performance.now() : 0;
const since = () => Math.round((typeof performance !== "undefined" ? performance.now() : 0) - t0);

const PROBE_W = 300;
const PROBE_H = 150;
/**
 * How long a detached canvas is given to be inserted before it is written off.
 *
 * 250, not 1200. The reasoning for 1200 was right and the number was still
 * too big: the scenes boot inside one ~400ms burst, so a 1200ms grace holds
 * every probe from that burst through the whole of it — the grace outlives
 * the crowd it was meant to thin. Traced, the burst is eight abandoned
 * contexts: unicornstudio-react's isWebGLSupported ran one per scene (x4;
 * gone now that components/UnicornScene.tsx hosts the scenes without the
 * probe) and unicornStudio.umd.js runs another four, each taking a context
 * to ask "does this work?" and never handing it back.
 *
 * 250ms is fifteen frames. A renderer that means to draw appends its canvas
 * in the commit that created it — one frame — so this is still an order of
 * magnitude of headroom over any real mounting path, while being short
 * enough to clear probes DURING the burst rather than after it.
 */
const REAP_AFTER_MS = 250;
/** How often to re-check the watch list. */
const SWEEP_MS = 120;
/**
 * Live contexts at which the page is treated as short of slots.
 *
 * Browsers cap around 16 and evict the OLDEST, and the navbar's glass is
 * among the first contexts the page takes — so the thing the cap costs is
 * always the chrome, on exactly the machines whose cap is lowest. Past this
 * mark a probe is reclaimed on the shorter fuse below, because taking back
 * a 60ms-old canvas that nothing can see is strictly better than letting
 * the browser choose a victim that is on screen.
 */
const PRESSURE_LIVE = 10;
/** The fuse under pressure. Still four frames — long past any real mount. */
const PRESSURE_REAP_AFTER_MS = 60;

type GL = WebGLRenderingContext | WebGL2RenderingContext;

/**
 * One canvas the census has seen take a context.
 *
 * Held WEAKLY. This list used to hold every canvas and context the page ever
 * made, and that was the phone reload (measured on the client's iPhone 12,
 * 23 Nov, heap snapshots while scrolling by hand): 30 live WebGL contexts
 * after one pass down the page and back, against 10 at the top, and the only
 * thing keeping most of them alive was this array. A scene that drops its
 * canvas without it ever being in the page, or at a size other than the
 * probe's, is never reaped here, so the census itself stopped the garbage
 * collector from freeing it, its drawing buffer and its textures, until iOS
 * killed the tab. The census must only ever observe and release, never keep.
 */
interface Tracked {
  canvasRef: WeakRef<HTMLCanvasElement>;
  glRef: WeakRef<GL> | null;
  label: string;
  at: number;
  origin: string;
  /** Set once we have released it, so it is never counted or reaped twice. */
  reaped: boolean;
  /** Has been in the document at some point (so it is a real scene, not a probe). */
  wasConnected: boolean;
  /** When it was last seen leaving the document (0: in it, or never in it). */
  detachedAt: number;
}

let tracked: Tracked[] = [];
/** Canvases already counted, without keeping them alive. */
const seen = new WeakSet<HTMLCanvasElement>();

/** The entry's canvas and context, or null once either has been collected. */
function live(t: Tracked): { canvas: HTMLCanvasElement; gl: GL } | null {
  const canvas = t.canvasRef.deref();
  const gl = t.glRef?.deref();
  return canvas && gl ? { canvas, gl } : null;
}

/** Drop entries with nothing left to release: collected, or already released. */
function prune() {
  tracked = tracked.filter((t) => !t.reaped && live(t) !== null);
}
const counts = { requested: 0, granted: 0, refused: 0, reaped: 0 };
/**
 * Every GPU object each context makes, so a context given back hands back its
 * memory too. Safari's `loseContext()` is a simulated loss: the context stays
 * restorable and keeps its textures, buffers and framebuffers. Measured on the
 * client's iPhone 12 (23 Nov): what was "released" that way stayed charged to
 * the tab, and the page closed under iOS's 1536 MB limit. Deleting each object
 * and shrinking the canvas (its drawing buffers) frees it at once.
 */
const GPU_KINDS = ["Texture", "Buffer", "Framebuffer", "Renderbuffer", "Program", "Shader", "VertexArray", "Query", "Sampler"] as const;
const gpuObjects = new WeakMap<GL, Map<string, Set<unknown>>>();
function trackGpuObjects(gl: GL) {
  if (gpuObjects.has(gl)) return;
  const byKind = new Map<string, Set<unknown>>();
  gpuObjects.set(gl, byKind);
  const g = gl as unknown as Record<string, (...a: unknown[]) => unknown>;
  for (const kind of GPU_KINDS) {
    const create = g["create" + kind];
    const del = g["delete" + kind];
    if (typeof create !== "function" || typeof del !== "function") continue;
    const set = new Set<unknown>();
    byKind.set(kind, set);
    g["create" + kind] = (...a: unknown[]) => {
      const o = create.apply(gl, a);
      if (o) set.add(o);
      return o;
    };
    g["delete" + kind] = (o: unknown) => {
      set.delete(o);
      return del.call(gl, o);
    };
  }
}
/** Deletes the context's GPU objects, shrinks its canvas, then loses it. */
function freeContext(gl: GL, canvas: HTMLCanvasElement | null) {
  if (!gl.isContextLost()) {
    const byKind = gpuObjects.get(gl);
    if (byKind) {
      for (const [kind, set] of byKind) {
        const del = (gl as unknown as Record<string, (o: unknown) => void>)["delete" + kind];
        for (const o of set) {
          try {
            del.call(gl, o);
          } catch {
            /* already gone */
          }
        }
        set.clear();
      }
    }
    if (canvas && !canvas.isConnected) {
      canvas.width = 1;
      canvas.height = 1;
    }
  }
  if (!gl.isContextLost()) gl.getExtension("WEBGL_lose_context")?.loseContext();
}

const t0IsGl = (t: unknown) => t === "webgl" || t === "webgl2" || t === "experimental-webgl";
let installed = false;

function labelFor(canvas: HTMLCanvasElement): string {
  const named = canvas.closest?.("[data-unicorn-scene]");
  if (named) return named.getAttribute("data-unicorn-scene") || "unicorn";
  if (!canvas.isConnected) return `detached ${canvas.width}x${canvas.height}`;
  const cls = canvas.parentElement?.className;
  return `${canvas.width}x${canvas.height} in .${
    (typeof cls === "string" && cls.split(/\s+/)[0]) || "?"
  }`;
}

/** First stack frame outside this file — names the library that asked. */
function callerFrame(): string {
  const nl = String.fromCharCode(10);
  const lines = (new Error().stack || "").split(nl).slice(1);
  for (const l of lines) {
    if (l.includes("webglContexts") || l.includes("unicornDebug")) continue;
    return l.trim().replace(/^at\s+/, "").slice(0, 160);
  }
  return "?";
}

const isProbe = (t: Tracked) => {
  if (t.reaped) return false;
  const l = live(t);
  return (
    !!l &&
    !l.gl.isContextLost() &&
    !l.canvas.isConnected &&
    l.canvas.width === PROBE_W &&
    l.canvas.height === PROBE_H
  );
};

/**
 * How long a scene's canvas may sit out of the document before its context
 * is given back. See releaseDropped.
 */
const DROPPED_AFTER_MS = 1500;

/**
 * Give back the contexts of scenes that have left the page.
 *
 * The phone reload (client, 20 Nov: "when you keep scrolling the page
 * automatically reloads"): iPhone Safari kills a tab's process when it runs
 * out of memory and reloads the page. Scrolling the page end to end makes
 * WebGL contexts by the dozen (measured: 75 in five and a half minutes on
 * an iPhone 17 simulator, 45 in two passes), because scenes are mounted near
 * the screen and unmounted away from it (useSceneLease). Most components
 * hand theirs back on unmount (releaseCanvasContext), but not all, and a
 * dropped canvas keeps its framebuffers and textures until garbage
 * collection, which on a phone comes late or after the OS has killed the
 * tab. So the census does it for every scene: a canvas that was in the
 * document and has been out of it for DROPPED_AFTER_MS is finished with.
 *
 * The wait keeps it safe: React's development double-mount puts a canvas
 * straight back, and nothing that means to show a canvas again leaves it
 * out of the page for a second and a half.
 */
/**
 * 2D canvases get the same treatment as dropped WebGL ones: a canvas that was
 * on the page and has been out of it for DROPPED_AFTER_MS gives back its
 * backing store (width and height to 0). Each one at a phone's 3x density is
 * up to ~12 MB, and they piled up across the page's rebuilds under the
 * atelier (8, then 23, then 31 live on the client's iPhone 12, 23 Nov), the
 * part of the per-visit growth that tipped the tab over iOS's limit.
 * Offscreen scratch canvases, never on the page, are left alone.
 */
type Tracked2d = { ref: WeakRef<HTMLCanvasElement>; wasConnected: boolean; detachedAt: number };
let tracked2d: Tracked2d[] = [];
const seen2d = new WeakSet<HTMLCanvasElement>();
function track2d(canvas: HTMLCanvasElement) {
  if (seen2d.has(canvas)) return;
  seen2d.add(canvas);
  tracked2d.push({ ref: new WeakRef(canvas), wasConnected: canvas.isConnected, detachedAt: 0 });
}
function releaseDropped2d(now: number) {
  tracked2d = tracked2d.filter((t) => {
    const c = t.ref.deref();
    if (!c) return false;
    if (c.isConnected) {
      t.wasConnected = true;
      t.detachedAt = 0;
      return true;
    }
    if (!t.wasConnected) return true;
    if (!t.detachedAt) {
      t.detachedAt = now;
      return true;
    }
    if (now - t.detachedAt < DROPPED_AFTER_MS) return true;
    c.width = 0;
    c.height = 0;
    return false;
  });
}

function releaseDropped(now: number) {
  for (const t of tracked) {
    if (t.reaped) continue;
    const l = live(t);
    if (!l) continue;
    if (l.canvas.isConnected) {
      t.wasConnected = true;
      t.detachedAt = 0;
      continue;
    }
    if (!t.wasConnected) continue; // a probe: sweep's business
    if (!t.detachedAt) {
      t.detachedAt = now;
      continue;
    }
    if (now - t.detachedAt < DROPPED_AFTER_MS) continue;
    t.reaped = true; // released on purpose, not reported as a loss
    try {
      freeContext(l.gl, l.canvas);
    } catch {
      /* already gone */
    }
  }
}

function sweep() {
  const now = since();
  try {
    releaseDropped(now);
    releaseDropped2d(now);
  } catch {
    /* bookkeeping must never break a page */
  }
  // Under pressure the fuse shortens; see PRESSURE_LIVE.
  const minAge =
    liveCount() >= PRESSURE_LIVE ? PRESSURE_REAP_AFTER_MS : REAP_AFTER_MS;
  for (const t of tracked) {
    if (now - t.at < minAge) continue;
    if (!isProbe(t)) continue;
    // `WEBGL_lose_context` is the only way to hand a context back on demand.
    // Absent (very old drivers) means we simply leave this one alone.
    const ext = t.glRef?.deref()?.getExtension("WEBGL_lose_context") as
      | { loseContext(): void }
      | null;
    if (!ext) continue;
    try {
      ext.loseContext();
      t.reaped = true;
      counts.reaped += 1;
    } catch {
      // A context that is already gone throws; nothing to do and nothing lost.
      t.reaped = true;
    }
  }
  prune();
}

const liveCount = () =>
  tracked.filter((t) => {
    if (t.reaped) return false;
    const l = live(t);
    return !!l && !l.gl.isContextLost();
  }).length;

/**
 * Wraps `getContext` once, for the whole page. The reaper needs this hook —
 * a detached canvas cannot be found by walking the DOM, so the only chance to
 * learn it exists is the moment it asks for a context.
 *
 * Import this as early as possible: probes start landing ~80ms in, and any
 * that are created before the wrap is in place are invisible to us and simply
 * keep their slot.
 */
export function installWebglContextManager() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    ...args: unknown[]
  ) {
    // Reclaim BEFORE granting. This is the one moment the page is provably
    // short of slots, so it is the one moment a freed probe is worth most —
    // the interval sweep may simply not have run recently enough. Wrapped so
    // that a failure here can never stop a caller getting its context.
    let isNew = false;
    try {
      const t0 = String(args[0]);
      isNew =
        (t0 === "webgl" || t0 === "webgl2" || t0 === "experimental-webgl") &&
        !seen.has(this);
      if (isNew) sweep();
    } catch {
      /* fall through and just grant it */
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (orig as any).apply(this, args);
    try {
      if (ctx && args[0] === "2d") track2d(this);
      if (!isNew) return ctx;

      counts.requested += 1;
      const label = labelFor(this);
      seen.add(this);
      const entry: Tracked = {
        canvasRef: new WeakRef(this),
        glRef: ctx ? new WeakRef(ctx as GL) : null,
        label,
        at: since(),
        origin: callerFrame(),
        reaped: false,
        wasConnected: this.isConnected,
        detachedAt: 0,
      };
      // A refused request leaves nothing to release, so nothing to track.
      if (ctx) tracked.push(entry);
      if (ctx && t0IsGl(args[0])) trackGpuObjects(ctx as GL);
      if (ctx) {
        counts.granted += 1;
      } else {
        counts.refused += 1;
      }
    } catch {
      // Bookkeeping must never break a page.
    }
    return ctx;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  window.setInterval(sweep, SWEEP_MS);

}

export const entries = () =>
  tracked.map((t) => {
    const l = live(t);
    return {
      label: t.label,
      at: t.at,
      ok: !!l,
      lost: !l || l.gl.isContextLost(),
      reaped: t.reaped,
      connected: !!l && l.canvas.isConnected,
      size: l ? `${l.canvas.width}x${l.canvas.height}` : "collected",
      origin: t.origin,
    };
  });

export const totals = () => ({
  ...counts,
  live: liveCount(),
  detachedProbesHeld: tracked.filter(isProbe).length,
});

export const getCensus = () => ({ live: liveCount, refused: () => counts.refused });

/**
 * Give a canvas's WebGL context back as soon as the canvas has left the
 * document — for scenes that are unmounted to free memory (useSceneLease).
 *
 * Unmounting a component does not release its context: a detached canvas
 * holds its slot, its framebuffers and every texture until garbage
 * collection gets round to it, which on a phone may be never, or after the
 * OS has already killed the tab. `loseContext()` releases it now.
 *
 * Checked a task later, and only if the canvas is really gone: React's
 * development double-mount runs an effect's cleanup with the canvas still in
 * the page and then re-runs the effect on it, and losing its context there
 * would leave the scene dead. The canvas must be one this census saw take a
 * context, so it never creates one just to lose it.
 */
export function releaseCanvasContext(canvas: HTMLCanvasElement | null | undefined) {
  if (!canvas) return;
  window.setTimeout(() => {
    if (canvas.isConnected) return;
    const t = tracked.find((x) => x.canvasRef.deref() === canvas);
    const gl = t?.glRef?.deref();
    if (!t || !gl || t.reaped || gl.isContextLost()) return;
    try {
      t.reaped = true; // released on purpose — not reported as a loss
      freeContext(gl, canvas);
    } catch {
      /* already gone */
    }
  }, 0);
}

/**
 * Give back the context of every canvas that has left the document. For the
 * moment the whole page is taken down under a full-screen overlay (the
 * atelier, template.tsx): each scene on it lets go of its canvas, but not of
 * the context, and without this the page's contexts stayed held under the
 * atelier's (measured, 22 Nov: 8 of 9 still live). Run a task after the page
 * is gone, so nothing that is about to be shown again is touched.
 */
export function releaseDetachedContexts() {
  window.setTimeout(() => {
    for (const t of tracked) {
      const l = live(t);
      if (!l || l.canvas.isConnected || t.reaped || l.gl.isContextLost()) continue;
      // Only canvases that were on the page: offscreen ones (troika's text
      // canvas in the atelier, kept and reused by its module) are sweep's.
      if (!t.wasConnected) continue;
      try {
        t.reaped = true;
        freeContext(l.gl, l.canvas);
      } catch {
        /* already gone */
      }
    }
    prune();
  }, 0);
}
