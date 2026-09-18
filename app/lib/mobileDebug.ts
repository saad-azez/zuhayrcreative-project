/**
 * Mobile debug log — the store behind the on-screen debug panel.
 *
 * Why it exists: the site "breaks apart" on phones, and a phone has no
 * devtools. Every section on the page is wrapped in <DebugSection> (see
 * components/debug), which reports into this store: when it mounts, when it
 * enters and leaves the screen, how fast the page draws while it is on
 * screen, how much GPU/image memory it holds, whether it overflows the
 * screen, whether its WebGL contexts are lost, and whether it crashed. The
 * store also catches every uncaught error, rejected promise, failed
 * resource and console.warn/error on the page, and tags each one with the
 * sections that were on screen at the time.
 *
 * Everything is printed to the real console as well, prefixed [MDBG], so a
 * cabled remote-debugging session (chrome://inspect, Safari Web Inspector)
 * sees the same lines.
 *
 * Crashes that kill the tab: iOS and Android reload a tab they killed for
 * memory, and nothing on the page survives that — except localStorage. The
 * log is saved there every couple of seconds, so the next load can show
 * what was happening when the previous one died ("Last load" in the panel).
 *
 * ON:  automatically on Android / iPhone / iPad; anywhere with ?debug=1.
 * OFF: ?debug=0 (remembered on the device until ?debug=1).
 */

import { applyCssSwitches, getOff } from "./killSwitch";

export type Level = "info" | "warn" | "error" | "perf" | "layout" | "gl";

export interface DebugEntry {
  /** ms since navigation start */
  t: number;
  lvl: Level;
  /** section name, or "page" / "console" / "webgl" / "viewport" … */
  src: string;
  msg: string;
  detail?: string;
}

export interface SectionStat {
  name: string;
  note?: string;
  state: "mounting" | "mounted" | "on screen" | "off screen" | "crashed";
  overlay: boolean;
  mountedAt?: number;
  firstVisibleAt?: number;
  width: number;
  height: number;
  /** widest overflow past the screen edge not clipped inside the section, px */
  overflowPx: number;
  overflowWho?: string;
  canvases: number;
  canvasMB: number;
  glLost: number;
  images: number;
  imageMB: number;
  failedResources: number;
  errors: number;
  warns: number;
  fpsMin: number | null;
  fpsSum: number;
  fpsN: number;
  longFrames: number;
  worstFrameMs: number;
  visibleNow: boolean;
}

interface SavedSession {
  id: string;
  url: string;
  startedAt: string;
  lastBeat: string;
  /** was the page on screen at the last heartbeat */
  visible: boolean;
  /** pagehide fired: the page was left normally */
  clean: boolean;
  entries: DebugEntry[];
  sections: SectionStat[];
}

const MAX_ENTRIES = 600;
const SAVED_ENTRIES = 200;
const KEY_FLAG = "mdbg";
const KEY_CUR = "mdbg:session";
const KEY_PREV = "mdbg:prev-session";

type W = Window & {
  __mdbgEarly?: { t: number; k: string; m: string; s?: string }[];
  __mdbgLive?: boolean;
  __mdbg?: unknown;
};

let enabled: boolean | null = null;
let installed = false;
const entries: DebugEntry[] = [];
const sections = new Map<string, SectionStat>();
const sectionEls = new Map<string, HTMLElement>();
const visible = new Set<string>();
const listeners = new Set<() => void>();
let prevSession: (SavedSession & { verdict: string }) | null = null;
let sessionId = "";
let currentFps = 0;
let dirty = false;

// The console's own methods, captured before the patch, so our mirror to
// the real console never loops back into the store.
const rawConsole: Pick<Console, "log" | "warn" | "error" | "info"> =
  typeof console !== "undefined"
    ? {
        log: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        info: console.info.bind(console),
      }
    : ({} as Console);

/* ── Enable ─────────────────────────────────────────────────────────── */

export function isPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /Android|iPhone|iPad|iPod/i.test(ua) ||
    // iPadOS reports itself as a Mac; only the touch points give it away.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

export function isEnabled(): boolean {
  if (enabled !== null) return enabled;
  if (typeof window === "undefined") return false;
  let flag: string | null = null;
  try {
    const m = /[?&]debug=([01])/.exec(location.search);
    if (m) localStorage.setItem(KEY_FLAG, m[1]);
    flag = localStorage.getItem(KEY_FLAG);
  } catch {
    /* private mode: fall back to the device check */
  }
  enabled = flag === "1" || (flag !== "0" && isPhone());
  return enabled;
}

/* ── Formatting helpers ─────────────────────────────────────────────── */

export const now = () =>
  typeof performance !== "undefined" ? performance.now() : 0;

export const fmtT = (t: number) => `+${(t / 1000).toFixed(2)}s`;
export const mb = (bytes: number) => Math.round((bytes / 1048576) * 10) / 10;

/** A short, readable selector for an element: tag#id.class.class */
export function describe(el: Element | null | undefined): string {
  if (!el) return "?";
  let s = el.tagName.toLowerCase();
  if (el.id) s += `#${el.id}`;
  const cls =
    typeof el.className === "string"
      ? el.className.trim().split(/\s+/).filter(Boolean)
      : [];
  if (cls.length) s += "." + cls.slice(0, 2).join(".");
  return s.length > 70 ? s.slice(0, 67) + "…" : s;
}

function stringify(v: unknown): string {
  if (v instanceof Error)
    return `${v.name}: ${v.message}${v.stack ? "\n" + firstLines(v.stack, 4) : ""}`;
  if (typeof v === "string") return v;
  if (v instanceof Element) return `<${describe(v)}>`;
  try {
    const s = JSON.stringify(v);
    return s && s.length > 400 ? s.slice(0, 400) + "…" : String(s);
  } catch {
    return String(v);
  }
}

const firstLines = (s: string, n: number) =>
  s.split("\n").slice(0, n).map((l) => l.trim()).join("\n");

const onScreenList = () =>
  visible.size ? [...visible].join(", ") : "no tracked section";

/* ── Core ───────────────────────────────────────────────────────────── */

export function dlog(lvl: Level, src: string, msg: string, detail?: unknown) {
  if (!isEnabled()) return;
  const e: DebugEntry = { t: now(), lvl, src, msg };
  if (detail !== undefined) e.detail = stringify(detail);
  entries.push(e);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  const s = sections.get(src);
  if (s) {
    if (lvl === "error") s.errors++;
    else if (lvl === "warn" || lvl === "layout" || lvl === "gl") s.warns++;
  }
  const line = `[MDBG] ${fmtT(e.t)} [${src}] ${msg}`;
  const out =
    lvl === "error" ? rawConsole.error : lvl === "info" ? rawConsole.info : rawConsole.warn;
  try {
    if (lvl === "info") rawConsole.log(line, e.detail ?? "");
    else out(line, e.detail ?? "");
  } catch {
    /* never let logging break the page */
  }
  dirty = true;
  if (lvl === "error") save();
  notify();
}

let notifyQueued = false;
function notify() {
  if (notifyQueued) return;
  notifyQueued = true;
  setTimeout(() => {
    notifyQueued = false;
    listeners.forEach((fn) => fn());
  }, 400);
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const getEntries = () => entries;
export const getSections = () => [...sections.values()];
export const getPrevSession = () => prevSession;
export const getFps = () => currentFps;
export const getOnScreen = () => [...visible];

export function clearLog() {
  entries.length = 0;
  notify();
}

/* ── Sections ───────────────────────────────────────────────────────── */

export function registerSection(
  name: string,
  el: HTMLElement,
  opts: { note?: string; overlay?: boolean },
): SectionStat {
  let s = sections.get(name);
  if (!s) {
    s = {
      name,
      note: opts.note,
      state: "mounting",
      overlay: !!opts.overlay,
      width: 0,
      height: 0,
      overflowPx: 0,
      canvases: 0,
      canvasMB: 0,
      glLost: 0,
      images: 0,
      imageMB: 0,
      failedResources: 0,
      errors: 0,
      warns: 0,
      fpsMin: null,
      fpsSum: 0,
      fpsN: 0,
      longFrames: 0,
      worstFrameMs: 0,
      visibleNow: false,
    };
    sections.set(name, s);
  }
  sectionEls.set(name, el);
  return s;
}

export function unregisterSection(name: string) {
  sectionEls.delete(name);
  visible.delete(name);
  const s = sections.get(name);
  if (s && s.state !== "crashed") s.state = "mounted";
}

export function setVisible(name: string, on: boolean) {
  const s = sections.get(name);
  if (on) visible.add(name);
  else visible.delete(name);
  if (s) {
    s.visibleNow = on;
    if (s.state !== "crashed") s.state = on ? "on screen" : "off screen";
  }
  notify();
}

export function markCrashed(name: string) {
  const s = sections.get(name);
  if (s) s.state = "crashed";
  visible.delete(name);
  save();
}

export const sectionOf = (el: Element | null | undefined) =>
  el?.closest?.("[data-debug-section]")?.getAttribute("data-debug-section") ?? null;

/** The element children a section wrapper (display:contents) stands for.
    A fixed child (a wipe's curtain) is always "in" the viewport and would
    make its section read as on screen everywhere, so fixed children are
    left out whenever the section has an in-flow child to go by. */
export function sectionRoots(wrapper: HTMLElement): HTMLElement[] {
  const all = [...wrapper.children].filter(
    (c): c is HTMLElement => c instanceof HTMLElement,
  );
  const inFlow = all.filter((c) => getComputedStyle(c).position !== "fixed");
  return inFlow.length ? inFlow : all;
}

/** A zero-height root whose content is absolutely placed (the blur seams)
    is not collapsed: something inside it still has a box. */
function hasPaintedContent(wrapper: HTMLElement) {
  const all = wrapper.querySelectorAll<HTMLElement>("*");
  for (let i = 0; i < Math.min(all.length, 400); i++) {
    const r = all[i].getBoundingClientRect();
    if (r.width > 2 && r.height > 2) return true;
  }
  return false;
}

export function unionRect(els: HTMLElement[]) {
  let top = Infinity,
    left = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (top === Infinity) return { top: 0, left: 0, width: 0, height: 0 };
  return { top, left, width: right - left, height: bottom - top };
}

/** Canvas backing stores and decoded images inside a section — the two
    things that run a phone out of memory. */
export function measureMedia(wrapper: HTMLElement) {
  const canvases = [...wrapper.querySelectorAll("canvas")];
  let canvasBytes = 0;
  const canvasList: string[] = [];
  for (const c of canvases) {
    const b = c.width * c.height * 4;
    canvasBytes += b;
    const r = c.getBoundingClientRect();
    canvasList.push(
      `${describe(c.parentElement)}>canvas ${Math.round(r.width)}×${Math.round(r.height)}css → ${c.width}×${c.height}px backing (${mb(b)} MB)`,
    );
  }
  const imgs = [...wrapper.querySelectorAll("img")];
  let imgBytes = 0;
  for (const i of imgs) if (i.complete) imgBytes += i.naturalWidth * i.naturalHeight * 4;
  const videos = wrapper.querySelectorAll("video").length;
  return {
    canvases: canvases.length,
    canvasMB: mb(canvasBytes),
    canvasList,
    images: imgs.length,
    imageMB: mb(imgBytes),
    videos,
  };
}

/* ── Layout audit ───────────────────────────────────────────────────── */

const lastAudit = new Map<string, string>();
/** Overflow is logged once per section per screen width: a strip that runs
    off the edge moves every frame and would otherwise log on every audit. */
const overflowLogged = new Set<string>();

/**
 * Looks for the classic "phone layout breaks apart" causes: the page wider
 * than the screen (sideways wobble), sections collapsed to nothing, and
 * elements hanging past the screen edge that nothing inside their section
 * clips. Only CHANGES are logged, so it can run on every resize.
 */
export function runLayoutAudit(reason: string) {
  if (!isEnabled() || typeof document === "undefined") return;
  const de = document.documentElement;
  const vw = de.clientWidth;
  const docW = Math.max(de.scrollWidth, document.body?.scrollWidth ?? 0);
  const pageKey = `${vw}|${docW}`;
  if (lastAudit.get("__page") !== pageKey) {
    lastAudit.set("__page", pageKey);
    if (docW > vw + 1)
      dlog(
        "layout",
        "page",
        `The page is ${docW - vw}px WIDER than the screen (${docW}px vs ${vw}px) — it can be dragged sideways and looks like it is breaking apart. See the sections below for who overflows.`,
        { reason },
      );
  }

  for (const [name, wrapper] of sectionEls) {
    const s = sections.get(name);
    if (!s || !wrapper.isConnected) continue;
    const roots = sectionRoots(wrapper);
    const u = unionRect(roots);
    s.width = Math.round(u.width);
    s.height = Math.round(u.height);

    const media = measureMedia(wrapper);
    s.canvases = media.canvases;
    s.canvasMB = media.canvasMB;
    s.images = media.images;
    s.imageMB = media.imageMB;

    // Overflow: elements past the screen edge whose overflow no ancestor
    // INSIDE the section clips (main's overflow-x-clip is outside it, so
    // these show up cut off at the screen edge on a phone).
    let worst = 0;
    const who: string[] = [];
    if (!s.overlay) {
      const all = wrapper.querySelectorAll<HTMLElement>("*");
      const n = Math.min(all.length, 800);
      for (let i = 0; i < n; i++) {
        const el = all[i];
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const over = Math.max(r.right - vw, -r.left);
        if (over <= 2) continue;
        if (clippedWithin(el, wrapper)) continue;
        const cs = getComputedStyle(el);
        if (cs.position === "fixed" || cs.visibility === "hidden" || cs.opacity === "0") continue;
        if (over > worst) worst = over;
        if (who.length < 3)
          who.push(`${describe(el)} spans ${Math.round(r.left)}→${Math.round(r.right)}px`);
      }
    }
    s.overflowPx = Math.round(worst);
    s.overflowWho = who.join("; ");

    const key = `${s.width}|${s.height}|${media.canvases}|${media.canvasMB}`;
    const overflowKey = `${name}|${vw}`;
    const newOverflow = s.overflowPx > 0 && !overflowLogged.has(overflowKey);
    if (newOverflow) overflowLogged.add(overflowKey);
    if (lastAudit.get(name) === key && !newOverflow) continue;
    lastAudit.set(name, key);

    if (!s.overlay && s.height < 2 && s.mountedAt !== undefined && !hasPaintedContent(wrapper))
      dlog(
        "layout",
        name,
        `Collapsed to ${s.height}px tall — the section is on the page but takes no space (content failed to render, or its height depends on something that has not loaded).`,
        { reason, roots: roots.map(describe) },
      );
    if (newOverflow)
      dlog(
        "layout",
        name,
        `Hangs ${s.overflowPx}px past the screen edge (screen is ${vw}px wide), clipped only by <main>. Intentional for a strip/carousel that runs off the edge; a bug if this is text or a box that should fit — it would look cut off.`,
        { reason, worst: who },
      );
    if (!s.overlay && s.width > vw + 2)
      dlog(
        "layout",
        name,
        `Section box is ${s.width}px wide on a ${vw}px screen.`,
        { reason },
      );
    if (media.canvasMB > 40)
      dlog(
        "perf",
        name,
        `Holds ${media.canvasMB} MB of canvas backing store in ${media.canvases} canvas(es) — heavy for a phone's GPU memory.`,
        media.canvasList,
      );
  }
  notify();
}

function clippedWithin(el: HTMLElement, stop: HTMLElement): boolean {
  let p = el.parentElement;
  let hops = 0;
  while (p && p !== stop && hops < 12) {
    const cs = getComputedStyle(p);
    if (cs.overflowX === "hidden" || cs.overflowX === "clip" || cs.overflowX === "auto" || cs.overflowX === "scroll")
      return true;
    if (cs.clipPath && cs.clipPath !== "none") return true;
    p = p.parentElement;
    hops++;
  }
  return false;
}

/* ── WebGL (called from lib/webglContexts.ts) ───────────────────────── */

export function glEvent(
  kind: "granted" | "refused" | "lost",
  label: string,
  canvas: HTMLCanvasElement,
  live: number,
) {
  if (!isEnabled()) return;
  const report = () => {
    const sec = sectionOf(canvas) ?? (canvas.isConnected ? "untracked" : "detached probe");
    const s = sections.get(sec);
    if (kind === "lost" && s) s.glLost++;
    const size = `${canvas.width}×${canvas.height}`;
    if (kind === "granted") {
      if (sec === "detached probe") return; // capability probes: noise
      dlog("gl", sec, `WebGL context granted to ${label} (${size}) — ${live} live contexts on the page.`);
    } else if (kind === "refused") {
      dlog(
        "error",
        sec,
        `WebGL context REFUSED for ${label} — the browser would not create one (${live} live; phones cap around 8–16). This canvas will stay blank.`,
      );
    } else {
      dlog(
        "gl",
        sec,
        `WebGL context LOST on ${label} (${size}) — the browser took it back (too many contexts or GPU memory pressure). ${live} still live. If it does not recover, this section goes blank.`,
      );
    }
  };
  // A freshly granted canvas is usually not in the document yet; give its
  // renderer a moment to insert it so the section can be named.
  if (kind === "granted") setTimeout(report, 1200);
  else report();
}

/* ── Device ─────────────────────────────────────────────────────────── */

export function deviceInfo(withGpu = false): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const n = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string; saveData?: boolean; downlink?: number };
  };
  const vv = window.visualViewport;
  const mq = (q: string) => window.matchMedia(q).matches;
  const info: Record<string, unknown> = {
    url: location.href,
    userAgent: n.userAgent,
    devicePixelRatio: window.devicePixelRatio,
    viewport: `${innerWidth}×${innerHeight}`,
    visualViewport: vv ? `${Math.round(vv.width)}×${Math.round(vv.height)} @${vv.scale}` : "n/a",
    screen: `${screen.width}×${screen.height}`,
    orientation: screen.orientation?.type ?? String((window as { orientation?: number }).orientation ?? "?"),
    deviceMemoryGB: n.deviceMemory ?? "n/a (Safari hides it)",
    cpuCores: n.hardwareConcurrency,
    touchPoints: n.maxTouchPoints,
    pointer: mq("(pointer: coarse)") ? "coarse" : "fine",
    hover: mq("(hover: hover)") ? "hover" : "none",
    reducedMotion: mq("(prefers-reduced-motion: reduce)"),
    network: n.connection
      ? `${n.connection.effectiveType} ${n.connection.downlink ?? "?"}Mbps${n.connection.saveData ? " saveData" : ""}`
      : "n/a",
    switchedOff: getOff().join(", ") || "nothing",
  };
  const pm = (performance as Performance & {
    memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
  }).memory;
  if (pm) info.jsHeap = `${mb(pm.usedJSHeapSize)} / ${mb(pm.jsHeapSizeLimit)} MB`;
  if (withGpu) {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl") as WebGLRenderingContext | null;
      if (gl) {
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        info.gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        info.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      } else info.gpu = "WebGL unavailable";
    } catch (e) {
      info.gpu = `probe failed: ${String(e)}`;
    }
  }
  return info;
}

/* ── Persistence ────────────────────────────────────────────────────── */

let clean = false;
function save() {
  if (!sessionId) return;
  try {
    const s: SavedSession = {
      id: sessionId,
      url: location.href,
      startedAt: new Date(performance.timeOrigin).toISOString(),
      lastBeat: new Date().toISOString(),
      visible: document.visibilityState === "visible",
      clean,
      entries: entries.slice(-SAVED_ENTRIES),
      sections: getSections(),
    };
    localStorage.setItem(KEY_CUR, JSON.stringify(s));
    dirty = false;
  } catch {
    /* quota / private mode — the live panel still works */
  }
}

function loadPrevious() {
  try {
    const raw = localStorage.getItem(KEY_CUR);
    if (!raw) {
      const kept = localStorage.getItem(KEY_PREV);
      if (kept) prevSession = JSON.parse(kept);
      return;
    }
    const p = JSON.parse(raw) as SavedSession;
    const verdict = p.clean
      ? "ended normally (the page was left or reloaded on purpose)"
      : p.visible
        ? "DID NOT END NORMALLY while it was on screen — the tab most likely crashed or was killed for memory, then reloaded"
        : "ended while in the background (the OS may have discarded it — usually harmless)";
    prevSession = { ...p, verdict };
    localStorage.setItem(KEY_PREV, JSON.stringify(prevSession));
  } catch {
    /* corrupt or unavailable */
  }
}

export function reportText(which: "current" | "previous" = "current"): string {
  const lines: string[] = [];
  const src =
    which === "previous" && prevSession
      ? { entries: prevSession.entries, sections: prevSession.sections }
      : { entries, sections: getSections() };
  lines.push(`=== Zuhayr Creative mobile debug report (${which} load) ===`);
  if (which === "previous" && prevSession) {
    lines.push(`Previous load ${prevSession.verdict}.`);
    lines.push(`Started ${prevSession.startedAt}, last heartbeat ${prevSession.lastBeat}, ${prevSession.url}`);
  }
  lines.push(`Captured ${new Date().toISOString()}`);
  for (const [k, v] of Object.entries(deviceInfo())) lines.push(`${k}: ${v}`);
  lines.push("", "--- Sections ---");
  for (const s of src.sections) {
    lines.push(
      `${s.name}: ${s.state}; ${s.width}×${s.height}px; overflow ${s.overflowPx}px${s.overflowWho ? ` (${s.overflowWho})` : ""}; ` +
        `canvases ${s.canvases} (${s.canvasMB} MB, ${s.glLost} lost); images ${s.images} (${s.imageMB} MB, ${s.failedResources} failed); ` +
        `fps min ${s.fpsMin ?? "–"} avg ${s.fpsN ? Math.round(s.fpsSum / s.fpsN) : "–"}; long frames ${s.longFrames} (worst ${Math.round(s.worstFrameMs)}ms); ` +
        `errors ${s.errors}, warnings ${s.warns}`,
    );
  }
  lines.push("", "--- Log ---");
  for (const e of src.entries)
    lines.push(`${fmtT(e.t)} ${e.lvl.toUpperCase()} [${e.src}] ${e.msg}${e.detail ? "\n    " + e.detail.replace(/\n/g, "\n    ") : ""}`);
  return lines.join("\n");
}

/* ── Install: global capture ────────────────────────────────────────── */

export function installMobileDebug() {
  if (installed || typeof window === "undefined" || !isEnabled()) return;
  installed = true;
  const w = window as W;
  w.__mdbgLive = true;
  sessionId = Math.random().toString(36).slice(2, 10);
  loadPrevious();
  applyCssSwitches();

  dlog(
    "info",
    "page",
    `Debug logging started on ${isPhone() ? "a phone/tablet" : "a desktop (forced with ?debug=1)"} — ${innerWidth}×${innerHeight} CSS px at ${devicePixelRatio}x.`,
    deviceInfo(),
  );
  if (prevSession && !prevSession.clean && prevSession.visible) {
    const last = prevSession.entries.slice(-1)[0];
    dlog(
      "error",
      "page",
      `The PREVIOUS load of this page ${prevSession.verdict}. Sections on screen at the end: ${
        prevSession.sections.filter((s) => s.visibleNow).map((s) => s.name).join(", ") || "unknown"
      }. Last thing it logged: ${last ? `${fmtT(last.t)} [${last.src}] ${last.msg}` : "nothing"}. Open "Last load" for the full log.`,
    );
  }

  // Errors caught by the inline head script before this module loaded.
  for (const e of w.__mdbgEarly ?? [])
    entries.push({ t: e.t, lvl: "error", src: "page", msg: `Before the app started: ${e.k} — ${e.m}`, detail: e.s });

  window.addEventListener(
    "error",
    (ev) => {
      const t = ev.target as Element | null;
      if (t && t !== (window as unknown) && t instanceof Element) {
        const url = (t as HTMLImageElement).currentSrc || (t as HTMLImageElement).src || (t as HTMLLinkElement).href || "";
        const sec = sectionOf(t) ?? "page";
        const s = sections.get(sec);
        if (s) s.failedResources++;
        dlog("error", sec, `A <${t.tagName.toLowerCase()}> failed to load: ${url || describe(t)}`);
        return;
      }
      dlog(
        "error",
        "page",
        `Uncaught error: ${ev.message} (at ${ev.filename?.split("/").pop()}:${ev.lineno}:${ev.colno}). On screen: ${onScreenList()}.`,
        ev.error ?? undefined,
      );
    },
    true,
  );
  window.addEventListener("unhandledrejection", (ev) => {
    const r = ev.reason;
    dlog(
      "error",
      "page",
      `Unhandled promise rejection: ${r?.message ?? String(r)}. On screen: ${onScreenList()}.`,
      r instanceof Error ? r : undefined,
    );
  });

  // console.warn / console.error from the app and its libraries.
  (["warn", "error"] as const).forEach((k) => {
    const orig = console[k];
    console[k] = (...args: unknown[]) => {
      try {
        const msg = args.map(stringify).join(" ");
        if (!msg.startsWith("[MDBG]"))
          entries.push({ t: now(), lvl: k === "error" ? "error" : "warn", src: "console", msg: `console.${k}: ${msg.slice(0, 600)}` });
        if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
        dirty = true;
        notify();
      } catch {
        /* ignore */
      }
      return orig.apply(console, args);
    };
  });

  // App lifecycle events the site broadcasts.
  for (const name of [
    "app:reveal",
    "app:uncovered",
    "app:menu-open",
    "app:menu-close",
    "app:scroll-lock",
    "app:scroll-unlock",
  ])
    window.addEventListener(name, () => {
      dlog("info", "page", `App event "${name}" — on screen: ${onScreenList()}.`);
      if (name === "app:uncovered") setTimeout(() => runLayoutAudit("after the loader lifted"), 800);
    });

  // Viewport.
  let vpTimer = 0;
  let lastVp = `${innerWidth}×${innerHeight}`;
  const onVp = (why: string) => {
    clearTimeout(vpTimer);
    vpTimer = window.setTimeout(() => {
      const vp = `${innerWidth}×${innerHeight}`;
      if (vp === lastVp) return;
      const vv = window.visualViewport;
      dlog(
        "info",
        "viewport",
        `Viewport changed ${lastVp} → ${vp} (${why}; visual ${vv ? `${Math.round(vv.width)}×${Math.round(vv.height)}` : "?"}). On a phone this is usually the address bar showing/hiding or a rotation — every full-height section relayouts.`,
      );
      lastVp = vp;
      runLayoutAudit(`viewport ${vp}`);
    }, 500);
  };
  window.addEventListener("resize", () => onVp("resize"));
  window.addEventListener("orientationchange", () => onVp("rotation"));

  // Page lifecycle + persistence.
  document.addEventListener("visibilitychange", () => {
    dlog("info", "page", `Page ${document.visibilityState === "visible" ? "came back to the foreground" : "went to the background"}.`);
    resetFrameClock();
    save();
  });
  window.addEventListener("pagehide", () => {
    clean = true;
    save();
  });
  window.addEventListener("pageshow", (e) => {
    if ((e as PageTransitionEvent).persisted) {
      clean = false;
      dlog("info", "page", "Restored from the back/forward cache.");
    }
  });
  window.addEventListener("load", () => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    dlog(
      "info",
      "page",
      `Window load finished${nav ? ` — DOM ready at ${Math.round(nav.domContentLoadedEventEnd)}ms, load at ${Math.round(nav.loadEventEnd || now())}ms` : ""}.`,
    );
    setTimeout(() => runLayoutAudit("window load"), 1500);
  });
  window.setInterval(() => {
    if (dirty) save();
  }, 4000);
  save();

  startFrameMonitor();
  startLongTasks();
  startMemory();

  w.__mdbg = { report: reportText, audit: runLayoutAudit, sections: getSections, entries: getEntries };
}

/* ── Frame rate, freezes, long tasks, memory ────────────────────────── */

let lastFrame = 0;
function resetFrameClock() {
  lastFrame = 0;
}

function startFrameMonitor() {
  let frames = 0;
  let secStart = 0;
  let lowStreak = 0;
  let lastFreezeLog = 0;
  const tick = (t: number) => {
    if (document.visibilityState === "visible") {
      if (lastFrame) {
        const dt = t - lastFrame;
        if (dt > 100) {
          for (const n of visible) {
            const s = sections.get(n);
            if (s) {
              s.longFrames++;
              s.worstFrameMs = Math.max(s.worstFrameMs, dt);
            }
          }
          if (dt > 1000)
            dlog(
              "error",
              "perf",
              `The page FROZE for ${Math.round(dt)}ms (nothing was drawn). On screen: ${onScreenList()}.`,
            );
          else if (dt > 250 && t - lastFreezeLog > 1500) {
            lastFreezeLog = t;
            dlog("perf", "perf", `A ${Math.round(dt)}ms stall (a visible hitch). On screen: ${onScreenList()}.`);
          }
        }
      }
      lastFrame = t;
      frames++;
      if (!secStart) secStart = t;
      if (t - secStart >= 1000) {
        const fps = Math.round((frames * 1000) / (t - secStart));
        currentFps = fps;
        for (const n of visible) {
          const s = sections.get(n);
          if (!s) continue;
          s.fpsSum += fps;
          s.fpsN++;
          s.fpsMin = s.fpsMin === null ? fps : Math.min(s.fpsMin, fps);
        }
        lowStreak = fps < 25 ? lowStreak + 1 : 0;
        if (lowStreak === 3)
          dlog(
            "perf",
            "perf",
            `Frame rate has been under 25fps for 3 seconds (now ${fps}fps). On screen: ${onScreenList()}.`,
          );
        frames = 0;
        secStart = t;
      }
    } else {
      lastFrame = 0;
      secStart = 0;
      frames = 0;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function startLongTasks() {
  try {
    if (!PerformanceObserver.supportedEntryTypes?.includes("longtask")) return; // Safari
    let lastLog = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.duration < 150) continue;
        const t = now();
        if (t - lastLog < 1000) continue;
        lastLog = t;
        dlog(
          "perf",
          "perf",
          `Main thread busy for ${Math.round(e.duration)}ms in one task (script/layout). On screen: ${onScreenList()}.`,
        );
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {
    /* unsupported */
  }
}

function startMemory() {
  const pm = (performance as Performance & {
    memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
  }).memory;
  if (!pm) return; // Safari / Firefox
  let logged = pm.usedJSHeapSize;
  window.setInterval(() => {
    const used = pm.usedJSHeapSize;
    if (used - logged > 30 * 1048576) {
      dlog(
        "perf",
        "memory",
        `JS heap grew to ${mb(used)} MB (+${mb(used - logged)} MB; limit ${mb(pm.jsHeapSizeLimit)} MB). On screen: ${onScreenList()}.`,
      );
      logged = used;
    } else if (used < logged) logged = used;
  }, 5000);
}
