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

import { ulog, uwarn, unicornDebugEnabled, since } from "./unicornDebug";

/** The size a canvas has before anyone sets one. A probe never leaves it. */
const PROBE_W = 300;
const PROBE_H = 150;
/**
 * How long a detached canvas is given to be inserted before it is written off.
 *
 * 1200, not 5000. The four scenes all boot inside one ~400ms burst (measured:
 * 1669→2036ms), which is precisely when the page is at its most crowded — and
 * a five-second grace meant every probe from that burst was still held through
 * it, so the peak still touched the cap and the browser still evicted
 * something. A probe is used synchronously and abandoned in the same tick;
 * 1200ms is three orders of magnitude longer than any createElement →
 * appendChild gap, and it clears the earlier probes in time to make room for
 * the burst.
 */
const REAP_AFTER_MS = 1200;
/** How often to re-check the watch list. */
const SWEEP_MS = 500;

type GL = WebGLRenderingContext | WebGL2RenderingContext;

interface Tracked {
  canvas: HTMLCanvasElement;
  gl: GL | null;
  label: string;
  at: number;
  origin: string;
  /** Set once we have released it, so it is never counted or reaped twice. */
  reaped: boolean;
}

const tracked: Tracked[] = [];
const counts = { requested: 0, granted: 0, refused: 0, reaped: 0 };
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

const isProbe = (t: Tracked) =>
  !t.reaped &&
  t.gl !== null &&
  !t.gl.isContextLost() &&
  !t.canvas.isConnected &&
  t.canvas.width === PROBE_W &&
  t.canvas.height === PROBE_H;

function sweep() {
  const now = since();
  for (const t of tracked) {
    if (now - t.at < REAP_AFTER_MS) continue;
    if (!isProbe(t)) continue;
    // `WEBGL_lose_context` is the only way to hand a context back on demand.
    // Absent (very old drivers) means we simply leave this one alone.
    const ext = t.gl?.getExtension("WEBGL_lose_context") as
      | { loseContext(): void }
      | null;
    if (!ext) continue;
    try {
      ext.loseContext();
      t.reaped = true;
      counts.reaped += 1;
      ulog("reaper", `released an abandoned probe (${t.label})`, {
        ageMs: now - t.at,
        origin: t.origin,
        liveNow: liveCount(),
        reapedTotal: counts.reaped,
      });
    } catch {
      // A context that is already gone throws; nothing to do and nothing lost.
      t.reaped = true;
    }
  }
}

const liveCount = () =>
  tracked.filter((t) => !t.reaped && t.gl && !t.gl.isContextLost()).length;

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
        !tracked.some((t) => t.canvas === this);
      if (isNew) sweep();
    } catch {
      /* fall through and just grant it */
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (orig as any).apply(this, args);
    try {
      const type = String(args[0]);
      if (!isNew) return ctx;

      counts.requested += 1;
      const label = labelFor(this);
      const entry: Tracked = {
        canvas: this,
        gl: (ctx as GL | null) ?? null,
        label,
        at: since(),
        origin: callerFrame(),
        reaped: false,
      };
      tracked.push(entry);
      if (ctx) {
        counts.granted += 1;
        this.addEventListener("webglcontextlost", () => {
          if (!entry.reaped)
            uwarn(label, "CONTEXT LOST", { liveNow: liveCount() });
        });
      } else {
        counts.refused += 1;
        uwarn(label, "CONTEXT REFUSED — getContext returned null", {
          type,
          ...counts,
        });
      }
      if (unicornDebugEnabled)
        ulog("census", `${type} ${ctx ? "granted" : "REFUSED"} to ${label}`, {
          live: liveCount(),
          requested: counts.requested,
        });
    } catch {
      // Diagnostics must never break a page.
    }
    return ctx;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  window.setInterval(sweep, SWEEP_MS);

  const w = window as Window & {
    __unicornCensus?: () => void;
    __unicornCensusRows?: () => unknown;
  };
  w.__unicornCensusRows = () => ({ entries: entries(), totals: totals() });
  w.__unicornCensus = () => {
    console.table(entries());
    console.log("[unicorn] totals", totals());
  };
  ulog("census", "installed — call __unicornCensus() for a table");
}

export const entries = () =>
  tracked.map((t) => ({
    label: t.label,
    at: t.at,
    ok: !!t.gl,
    lost: !!t.gl && t.gl.isContextLost(),
    reaped: t.reaped,
    connected: t.canvas.isConnected,
    size: `${t.canvas.width}x${t.canvas.height}`,
    origin: t.origin,
  }));

export const totals = () => ({
  ...counts,
  live: liveCount(),
  detachedProbesHeld: tracked.filter(isProbe).length,
});

export const getCensus = () => ({ live: liveCount, refused: () => counts.refused });
