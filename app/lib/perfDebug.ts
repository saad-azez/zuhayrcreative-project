/**
 * The performance debug collector — what the debug panel (components/
 * DebugPanel.tsx) shows, and the report it copies.
 *
 * Off for every visitor. It is installed only when the page is opened with
 * `?debug=1` (the flag then holds for the tab, across pages; `?debug=0`
 * clears it), and its code is only downloaded then (DebugPanelGate imports it
 * on demand). The client, 19 Oct: "create a debug panel to check where the
 * site is getting slowed and why".
 *
 * It changes nothing in the page. It watches from outside:
 *   - every frame's time, and every frame over FREEZE_MS as a freeze, with
 *     where the screen was at the time (the section at its centre, or an
 *     overlay over it) and the scroll position;
 *   - which scripts ran in that frame, where the browser says
 *     (long-animation-frame, Chrome 123+ and Android); and long tasks;
 *   - per canvas, per second: WebGL draw calls, texture uploads (in pixels)
 *     and GPU read-backs (readPixels, and a WebGL canvas drawn into a 2D one),
 *     which is the work a phone's GPU is asked for and its CPU waits on;
 *   - WebGL contexts made and lost; errors, rejections, console warnings;
 *   - the load: first byte, first paint, largest paint, load, and when the
 *     loading curtain lifted; and the downloads, largest first;
 *   - the device: screen, pixel ratio, cores, memory, GPU, network.
 * Every freeze, context loss and error is also written to the console as
 * `[PERF] …`, and the whole report is kept in localStorage every few seconds,
 * so a tab the phone kills for memory leaves it behind for the next load.
 */

type Listener = () => void;

/** A frame at least this long is a freeze. */
const FREEZE_MS = 100;
/** Kept, of each kind: the worst freezes, and the latest events. */
const KEEP_FREEZES = 40;
const KEEP_EVENTS = 120;
const STORE_KEY = "perfDebug:report";
const STORE_CLEAN = "perfDebug:clean";
const FLAG_KEY = "perfDebug";

/** Sections, by what each carries; the first match walking up wins. */
const KNOWN: [string, string][] = [
  ["#hero-banner", "hero"],
  ["#services", "services"],
  ['[data-section="gallery"]', "gallery"],
  ["#work", "work"],
  ["#seasons", "seasons"],
  ["#contact-footer", "footer (contact)"],
];

export interface Freeze {
  t: number;
  dur: number;
  where: string;
  scrollY: number;
  /** The busiest canvases in the second it happened in. */
  gpu: string;
  /** Scripts the browser saw running in it (long-animation-frame). */
  scripts: string;
}

interface CanvasStats {
  ref: WeakRef<HTMLCanvasElement> | null;
  label: string;
  kind: string;
  cur: { draws: number; upPx: number; reads: number };
  last: { draws: number; upPx: number; reads: number };
  total: { draws: number; upPx: number; reads: number; activeSecs: number };
}

interface SectionTime {
  ms: number;
  frames: number;
  freezes: number;
}

const state = {
  installed: false,
  t0: 0,
  frames: 0,
  frameMs: 0,
  freezes: [] as Freeze[],
  freezeCount: 0,
  freezeTotal: 0,
  events: [] as string[],
  bySection: new Map<string, SectionTime>(),
  canvases: [] as CanvasStats[],
  canvasOf: new WeakMap<HTMLCanvasElement, CanvasStats>(),
  contextsMade: 0,
  contextsLost: 0,
  longTasks: [] as [number, number][],
  loaf: [] as { start: number; dur: number; scripts: string }[],
  errors: 0,
  lcp: 0,
  curtainAt: 0,
  fps: 0,
  where: "page",
  readbacks2d: 0,
  previous: "" as string,
  previousClean: true,
};
const listeners = new Set<Listener>();
/** Bumped on every change, for useSyncExternalStore. */
let version = 0;
const notify = () => {
  version++;
  listeners.forEach((l) => l());
};

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export const getVersion = () => version;

/**
 * Whether debugging is on for this tab: `?debug=1` turns it on and `?debug=0`
 * off, and the answer is kept for the tab's later pages.
 */
export function debugFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("debug");
    if (q === "1") sessionStorage.setItem(FLAG_KEY, "1");
    if (q === "0") sessionStorage.removeItem(FLAG_KEY);
    return sessionStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return new URLSearchParams(window.location.search).get("debug") === "1";
  }
}

const now = () => performance.now();
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

function log(line: string) {
  const text = `${secs(now())} ${line}`;
  state.events.push(text);
  if (state.events.length > KEEP_EVENTS) state.events.shift();
  console.log(`[PERF] ${text}`);
}

/** The section an element is in, by name. */
function sectionOf(el: Element | null): string {
  for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
    if (e.hasAttribute("data-marble-canvas")) return "marble transition";
    for (const [sel, name] of KNOWN) if (e.matches(sel)) return name;
    if (e.tagName === "SECTION" || e.tagName === "FOOTER") {
      const named =
        e.getAttribute("aria-label") ||
        e.querySelector("h1, h2")?.textContent ||
        e.className.toString().split(" ")[0] ||
        e.tagName;
      return named.trim().replace(/\s+/g, " ").slice(0, 28).toLowerCase();
    }
  }
  return "page";
}

/** What the visitor is looking at: an overlay if one covers the screen, else the section at its centre. */
function whereNow(): string {
  const curtain = document.querySelector<HTMLElement>(".z-9999");
  if (curtain) {
    const r = curtain.getBoundingClientRect();
    const cs = getComputedStyle(curtain);
    if (r.bottom > 1 && cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0") return "loading screen";
  }
  if (document.body.classList.contains("is-idle")) return "idle screen";
  if (document.querySelector(".idle-brush")) return `${sectionAtCentre()} + idle countdown`;
  return sectionAtCentre();
}

function sectionAtCentre(): string {
  const els = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  for (const el of els) {
    const s = sectionOf(el);
    if (s !== "page") return s;
  }
  return "page";
}

// ── Per canvas ──────────────────────────────────────────────────────────────

function statsFor(canvas: HTMLCanvasElement | OffscreenCanvas | undefined, kind: string): CanvasStats | null {
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) return null;
  let s = state.canvasOf.get(canvas);
  if (!s) {
    s = {
      ref: typeof WeakRef !== "undefined" ? new WeakRef(canvas) : null,
      label: "",
      kind,
      cur: { draws: 0, upPx: 0, reads: 0 },
      last: { draws: 0, upPx: 0, reads: 0 },
      total: { draws: 0, upPx: 0, reads: 0, activeSecs: 0 },
    };
    state.canvasOf.set(canvas, s);
    state.canvases.push(s);
  }
  return s;
}

/**
 * A canvas, by name: its section, and what it is where that is all "page"
 * (the fixed layers: the background scene, the navbar, the cursor), from the
 * nearest marker it sits in.
 */
function labelCanvas(c: HTMLCanvasElement) {
  const size = `${c.width}x${c.height}`;
  if (!c.isConnected) return `offscreen ${size}`;
  if (c.hasAttribute("data-marble-canvas")) {
    // Named for the section it leads into: the first after its join.
    let into = "page";
    for (let sib = c.parentElement?.nextElementSibling ?? null, i = 0; sib && i < 4 && into === "page"; sib = sib.nextElementSibling, i++) {
      const s = sib.matches("section, footer, [data-section]") ? sib : sib.querySelector("section, footer, [data-section]");
      if (s) into = sectionOf(s);
    }
    return `marble transition into ${into} ${size}`;
  }
  let what = "";
  for (let e: Element | null = c; e && e !== document.body && !what; e = e.parentElement) {
    const scene = e.getAttribute("data-unicorn-scene");
    if (scene) what = `unicorn: ${scene}`;
    else if (e.tagName === "NAV" || e.tagName === "HEADER") what = "navbar";
    else if (e.id) what = `#${e.id}`;
    else if (e !== c && typeof e.className === "string" && e.className.trim()) what = `.${e.className.trim().split(/\s+/)[0]}`;
  }
  const where = sectionOf(c);
  return `${where === "page" ? what || "page" : `${where}${what && !what.startsWith("#") ? ` (${what})` : ""}`} ${size}`;
}

/** The pixels a texImage2D / texSubImage2D call uploads, from its arguments. */
function uploadPixels(sub: boolean, args: unknown[]): number {
  const last = args[args.length - 1];
  // Storage allocated with no pixels in it uploads nothing.
  if (last === null || last === undefined) return 0;
  // From an image, a canvas, a video or a bitmap: its own size.
  if (typeof last === "object" && !ArrayBuffer.isView(last)) {
    const src = last as { width?: number; height?: number; videoWidth?: number; videoHeight?: number };
    return (src.videoWidth || src.width || 0) * (src.videoHeight || src.height || 0);
  }
  // From an array: the size in the arguments.
  //   texImage2D(target, level, internalformat, width, height, border, format, type, pixels)
  //   texSubImage2D(target, level, x, y, width, height, format, type, pixels)
  const n = args as number[];
  return sub ? n[4] * n[5] : n[3] * n[4];
}

function hookWebGL(proto: object | undefined) {
  if (!proto) return;
  const p = proto as Record<string, unknown>;
  const wrap = (name: string, on: (s: CanvasStats, args: unknown[]) => void) => {
    const f = p[name];
    if (typeof f !== "function") return;
    p[name] = function (this: WebGLRenderingContext, ...args: unknown[]) {
      const s = statsFor(this.canvas as HTMLCanvasElement, "webgl");
      if (s) on(s, args);
      return (f as (...a: unknown[]) => unknown).apply(this, args);
    };
  };
  for (const d of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced", "drawRangeElements"]) {
    wrap(d, (s) => s.cur.draws++);
  }
  wrap("texImage2D", (s, a) => (s.cur.upPx += uploadPixels(false, a)));
  wrap("texSubImage2D", (s, a) => (s.cur.upPx += uploadPixels(true, a)));
  wrap("readPixels", (s) => s.cur.reads++);
}

function hook2D() {
  const p = CanvasRenderingContext2D.prototype;
  const getImageData = p.getImageData;
  p.getImageData = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof getImageData>) {
    const s = statsFor(this.canvas, "2d");
    if (s) s.cur.reads++;
    return getImageData.apply(this, args);
  };
  const drawImage = p.drawImage as (...a: unknown[]) => void;
  (p as unknown as { drawImage: (...a: unknown[]) => void }).drawImage = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
    const src = args[0];
    // A WebGL canvas drawn into a 2D one is read back from the GPU.
    if (src instanceof HTMLCanvasElement && state.canvasOf.get(src)?.kind === "webgl") {
      const s = statsFor(this.canvas, "2d");
      if (s) s.cur.reads++;
      state.readbacks2d++;
    }
    return drawImage.apply(this, args);
  };
}

function hookContexts() {
  const getContext = HTMLCanvasElement.prototype.getContext as (...a: unknown[]) => unknown;
  (HTMLCanvasElement.prototype as unknown as { getContext: (...a: unknown[]) => unknown }).getContext = function (
    this: HTMLCanvasElement,
    ...args: unknown[]
  ) {
    const ctx = getContext.apply(this, args);
    const type = args[0];
    if (ctx && (type === "webgl" || type === "webgl2" || type === "experimental-webgl")) {
      const fresh = !state.canvasOf.has(this) || state.canvasOf.get(this)?.kind !== "webgl";
      const s = statsFor(this, "webgl");
      if (s) s.kind = "webgl";
      if (fresh) {
        state.contextsMade++;
        // Where it is is known once it is in the page: labelled on the next roll.
      }
    }
    return ctx;
  };
  document.addEventListener(
    "webglcontextlost",
    (e) => {
      state.contextsLost++;
      const c = e.target as HTMLCanvasElement;
      log(`WebGL context LOST: ${labelCanvas(c)} (contexts made so far: ${state.contextsMade})`);
      notify();
    },
    true,
  );
}

/** Once a second: each canvas's counts move to "last second" and into its totals. */
function roll() {
  for (const s of state.canvases) {
    // Named while it is in the page; one that has left keeps its last name.
    const c = s.ref?.deref();
    if (c && (c.isConnected || !s.label)) s.label = labelCanvas(c);
    s.last = s.cur;
    if (s.cur.draws || s.cur.upPx || s.cur.reads) {
      s.total.draws += s.cur.draws;
      s.total.upPx += s.cur.upPx;
      s.total.reads += s.cur.reads;
      s.total.activeSecs++;
    }
    s.cur = { draws: 0, upPx: 0, reads: 0 };
  }
}

/** The busiest canvases in the last second, in a line. */
function busiest(n = 4): string {
  return state.canvases
    .filter((s) => s.last.draws || s.last.upPx || s.last.reads)
    .sort((a, b) => b.last.draws + b.last.upPx / 1e5 + b.last.reads * 50 - (a.last.draws + a.last.upPx / 1e5 + a.last.reads * 50))
    .slice(0, n)
    .map((s) => `${s.label || s.kind}: ${s.last.draws} draws` + (s.last.upPx ? `, ${(s.last.upPx / 1e6).toFixed(1)}Mpx up` : "") + (s.last.reads ? `, ${s.last.reads} reads` : ""))
    .join(" | ");
}

// ── Frames ──────────────────────────────────────────────────────────────────

function frames() {
  let last = now();
  let secStart = last;
  let secFrames = 0;
  const tick = () => {
    const t = now();
    const dt = t - last;
    last = t;
    state.frames++;
    state.frameMs += dt;
    secFrames++;
    const where = state.where;
    const sec = state.bySection.get(where) ?? { ms: 0, frames: 0, freezes: 0 };
    sec.ms += dt;
    sec.frames++;
    if (dt >= FREEZE_MS) {
      sec.freezes++;
      state.freezeCount++;
      state.freezeTotal += dt;
      const f: Freeze = { t: t - dt, dur: Math.round(dt), where, scrollY: Math.round(window.scrollY), gpu: busiest(), scripts: "" };
      state.freezes.push(f);
      state.freezes.sort((a, b) => b.dur - a.dur);
      if (state.freezes.length > KEEP_FREEZES) state.freezes.length = KEEP_FREEZES;
      log(`FREEZE ${f.dur}ms in ${where} (scroll ${f.scrollY})` + (f.gpu ? ` · GPU: ${f.gpu}` : ""));
    }
    state.bySection.set(where, sec);
    if (t - secStart >= 1000) {
      state.fps = Math.round((secFrames * 1000) / (t - secStart));
      secStart = t;
      secFrames = 0;
      roll();
      // Where the screen is, once a second (reading it every frame would cost
      // a layout of its own).
      state.where = whereNow();
      notify();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ── Long tasks, long animation frames, paints ───────────────────────────────

function observers() {
  const observe = (type: string, cb: (e: PerformanceEntry) => void) => {
    try {
      new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({ type, buffered: true } as PerformanceObserverInit);
    } catch {
      /* not in this browser (Safari has neither long tasks nor long animation frames) */
    }
  };
  observe("longtask", (e) => {
    state.longTasks.push([Math.round(e.startTime), Math.round(e.duration)]);
    if (state.longTasks.length > 400) state.longTasks.shift();
  });
  observe("long-animation-frame", (e) => {
    const lf = e as PerformanceEntry & {
      blockingDuration?: number;
      scripts?: {
        sourceURL?: string;
        sourceFunctionName?: string;
        invoker?: string;
        duration: number;
        forcedStyleAndLayoutDuration?: number;
      }[];
    };
    if (e.duration < FREEZE_MS) return;
    const scripts = (lf.scripts ?? [])
      .filter((s) => s.duration >= 10)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 4)
      .map((s) => {
        const file = (s.sourceURL ?? "").split("/").pop()?.split("?")[0] || "inline";
        const layout = s.forcedStyleAndLayoutDuration ? `, ${Math.round(s.forcedStyleAndLayoutDuration)}ms forced layout` : "";
        return `${Math.round(s.duration)}ms ${s.invoker ?? ""} ${s.sourceFunctionName ? `${s.sourceFunctionName}()` : ""} [${file}]${layout}`.replace(/\s+/g, " ");
      })
      .join("; ");
    state.loaf.push({ start: e.startTime, dur: e.duration, scripts: scripts || "(no script over 10ms: rendering, layout or GPU)" });
    if (state.loaf.length > 200) state.loaf.shift();
    // The freeze it explains, if one has been seen.
    for (const f of state.freezes) {
      if (!f.scripts && Math.abs(f.t - e.startTime) < 120) f.scripts = scripts;
    }
  });
  observe("largest-contentful-paint", (e) => (state.lcp = Math.round(e.startTime)));
}

function errors() {
  // A script error is an ErrorEvent; a file that failed to load is a plain
  // Event on its element (seen here because this listens in the capture phase).
  window.addEventListener("error", (e: Event) => {
    state.errors++;
    if (e instanceof ErrorEvent) log(`ERROR ${e.message} (${(e.filename ?? "").split("/").pop()}:${e.lineno})`);
    else {
      const t = e.target as HTMLElement & { src?: string; href?: string };
      log(`FAILED to load ${t?.tagName?.toLowerCase()} ${t?.src || t?.href || ""}`);
    }
  }, true);
  window.addEventListener("unhandledrejection", (e) => {
    state.errors++;
    log(`REJECTION ${String((e.reason as Error)?.message ?? e.reason).slice(0, 160)}`);
  });
  for (const level of ["warn", "error"] as const) {
    const orig = console[level];
    console[level] = (...args: unknown[]) => {
      const text = args.map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : "")).join(" ").trim();
      if (text && !text.startsWith("[PERF]")) {
        state.events.push(`${secs(now())} console.${level}: ${text.slice(0, 160)}`);
        if (state.events.length > KEEP_EVENTS) state.events.shift();
        if (level === "error") state.errors++;
      }
      orig.apply(console, args);
    };
  }
}

function curtain() {
  const check = () => {
    if (whereNow() !== "loading screen") {
      state.curtainAt = Math.round(now());
      log(`loading screen lifted (${secs(state.curtainAt)} after the page started)`);
      notify();
      return;
    }
    setTimeout(check, 200);
  };
  setTimeout(check, 200);
}

// ── The report ──────────────────────────────────────────────────────────────

function device(): string {
  const n = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string; downlink?: number; saveData?: boolean };
  };
  let gpu = "unknown";
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    if (gl && ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    /* no GPU name */
  }
  const net = n.connection ? `${n.connection.effectiveType ?? "?"}, ${n.connection.downlink ?? "?"} Mbps${n.connection.saveData ? ", data saver" : ""}` : "unknown";
  return [
    `Browser: ${navigator.userAgent}`,
    `Screen: ${window.innerWidth}x${window.innerHeight} CSS px at ${window.devicePixelRatio}x · cores ${navigator.hardwareConcurrency ?? "?"} · memory ${n.deviceMemory ?? "?"} GB`,
    `GPU: ${gpu}`,
    `Network: ${net} · reduced motion: ${matchMedia("(prefers-reduced-motion: reduce)").matches ? "yes" : "no"}`,
    `Page: ${location.pathname}${location.search} · classes: ${document.documentElement.className}`,
  ].join("\n");
}
let deviceText = "";

function loadLine(): string {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime;
  const ms = (v?: number) => (v ? `${Math.round(v)}ms` : "?");
  return `Load: first byte ${ms(nav?.responseStart)} · first paint ${ms(fcp)} · largest paint ${ms(state.lcp)} · DOM ready ${ms(nav?.domContentLoadedEventEnd)} · load ${ms(nav?.loadEventEnd)} · loading screen lifted ${state.curtainAt ? ms(state.curtainAt) : "not yet"}`;
}

function downloads(): string {
  const rs = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const total = rs.reduce((a, r) => a + (r.transferSize || 0), 0);
  const kb = (b: number) => `${Math.round(b / 1024)}KB`;
  const top = [...rs]
    .sort((a, b) => (b.transferSize || b.encodedBodySize || 0) - (a.transferSize || a.encodedBodySize || 0))
    .slice(0, 10)
    .map((r) => `  ${kb(r.transferSize || r.encodedBodySize || 0)} ${Math.round(r.duration)}ms ${r.name.replace(/^https?:\/\/[^/]+/, "").slice(0, 90)}`);
  return [`Downloads: ${rs.length} files, ${kb(total)} over the network (0 = from cache)`, ...top].join("\n");
}

export function report(): string {
  const run = now();
  const fpsAvg = state.frames ? Math.round((state.frames * 1000) / state.frameMs) : 0;
  const sections = [...state.bySection]
    .filter(([, s]) => s.ms > 500)
    .sort((a, b) => b[1].ms - a[1].ms)
    .map(([name, s]) => `  ${name}: ${Math.round((s.frames * 1000) / s.ms)} fps over ${secs(s.ms)}, ${s.freezes} freezes`);
  const canvases = state.canvases
    .filter((s) => s.total.activeSecs > 0)
    .sort((a, b) => b.total.draws - a.total.draws)
    .slice(0, 12)
    .map((s) => {
      const per = (v: number) => Math.round(v / Math.max(1, s.total.activeSecs));
      return `  ${s.label || s.kind}: active ${s.total.activeSecs}s · ${per(s.total.draws)} draws/s · ${(per(s.total.upPx) / 1e6).toFixed(2)} Mpx/s uploaded · ${per(s.total.reads)} reads/s`;
    });
  const freezes = state.freezes.slice(0, 15).map(
    (f) => `  ${secs(f.t)} ${f.dur}ms in ${f.where} (scroll ${f.scrollY})` + (f.gpu ? `\n      GPU that second: ${f.gpu}` : "") + (f.scripts ? `\n      scripts: ${f.scripts}` : ""),
  );
  const lt = state.longTasks;
  const longest = [...lt].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s, d]) => `${d}ms@${secs(s)}`).join(", ");
  const loafNoFreeze = state.loaf
    .filter((l) => !state.freezes.some((f) => Math.abs(f.t - l.start) < 120))
    .sort((a, b) => b.dur - a.dur)
    .slice(0, 6)
    .map((l) => `  ${secs(l.start)} ${Math.round(l.dur)}ms: ${l.scripts}`);
  return [
    `[PERF] report · ${new Date().toISOString()} · ${secs(run)} since the page started`,
    deviceText,
    loadLine(),
    `Frames: ${fpsAvg} fps on average · ${state.freezeCount} freezes over ${FREEZE_MS}ms, ${secs(state.freezeTotal)} frozen in all`,
    `Long tasks: ${lt.length}, ${secs(lt.reduce((a, [, d]) => a + d, 0))} in all${longest ? ` · longest ${longest}` : " (not reported by this browser)"}`,
    `WebGL: ${state.contextsMade} contexts made, ${state.contextsLost} lost · ${state.readbacks2d} WebGL→2D read-backs · errors ${state.errors}`,
    "",
    "Time and fps by what was on screen:",
    ...sections,
    "",
    "Worst freezes:",
    ...(freezes.length ? freezes : ["  none"]),
    ...(loafNoFreeze.length ? ["", "Other long frames (scripts):", ...loafNoFreeze] : []),
    "",
    "Canvases (while active):",
    ...(canvases.length ? canvases : ["  none"]),
    "",
    downloads(),
    "",
    "Events (latest last):",
    ...state.events.slice(-40).map((e) => `  ${e}`),
  ].join("\n");
}

/** The live line in the panel's pill. */
export function live() {
  return {
    fps: state.fps,
    where: state.where,
    freezes: state.freezeCount,
    contexts: state.contextsMade,
    lost: state.contextsLost,
    errors: state.errors,
    busiest: busiest(3),
    events: state.events.slice(-30),
    previous: state.previous,
    previousClean: state.previousClean,
  };
}

export function clearLog() {
  state.events = [];
  state.freezes = [];
  state.freezeCount = 0;
  state.freezeTotal = 0;
  state.bySection.clear();
  state.frames = 0;
  state.frameMs = 0;
  for (const s of state.canvases) s.total = { draws: 0, upPx: 0, reads: 0, activeSecs: 0 };
  notify();
}

/** Installs the collector, once. */
export function installPerfDebug() {
  if (state.installed || typeof window === "undefined") return;
  state.installed = true;
  state.t0 = now();
  // The last load's report, and whether that load ended cleanly (a phone that
  // kills a tab for memory reloads it, and this is all that is left).
  try {
    state.previous = localStorage.getItem(STORE_KEY) ?? "";
    state.previousClean = localStorage.getItem(STORE_CLEAN) !== "0";
    localStorage.setItem(STORE_CLEAN, "0");
    window.addEventListener("pagehide", () => {
      try {
        localStorage.setItem(STORE_KEY, report());
        localStorage.setItem(STORE_CLEAN, "1");
      } catch {
        /* storage full or blocked */
      }
    });
    setInterval(() => {
      try {
        localStorage.setItem(STORE_KEY, report());
      } catch {
        /* storage full or blocked */
      }
    }, 4000);
  } catch {
    /* no storage: no previous report */
  }
  // Before the hooks, so its one throwaway context is not counted as the page's.
  deviceText = device();
  hookContexts();
  hookWebGL(window.WebGLRenderingContext?.prototype);
  hookWebGL(window.WebGL2RenderingContext?.prototype);
  hook2D();
  errors();
  observers();
  // The freezes from before this was installed, as the gate measured them;
  // and the gate's own frame loop stopped, as this one takes over.
  const w = window as Window & { __perfEarly?: [number, number][]; __perfEarlyStop?: boolean };
  w.__perfEarlyStop = true;
  const early = w.__perfEarly ?? [];
  for (const [t, d] of early) {
    state.freezeCount++;
    state.freezeTotal += d;
    state.freezes.push({ t, dur: Math.round(d), where: "loading screen (before the panel started)", scrollY: 0, gpu: "", scripts: "" });
  }
  state.freezes.sort((a, b) => b.dur - a.dur);
  state.where = whereNow();
  frames();
  curtain();
  log(`debug on · ${window.innerWidth}x${window.innerHeight} at ${window.devicePixelRatio}x`);
  if (state.previous && !state.previousClean) log("the previous load did not end cleanly (the tab may have been killed): its report is under 'Previous'");
}
