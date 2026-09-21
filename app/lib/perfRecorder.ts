/**
 * The on-device frame recorder — why the site feels laggy on a phone, measured
 * on the phone.
 *
 * ── Why this exists, again ────────────────────────────────────────────────
 *
 * The scaffolding stripped in ba9679a answered a different question: the site
 * BREAKS on phones. Layout audits, crash forensics, a verdict for how the last
 * load ended. This one answers the question that is left: the site works, and
 * it feels slow. That is a per-frame question, and a Lighthouse score cannot
 * see it — every point of that score is about the first load, and none of it
 * about the thousandth frame of a scroll.
 *
 * So this records frames, attributes them to the section on screen, and splits
 * them by whether the reader was scrolling at the time. A section that holds
 * 60fps at rest and collapses to 12 under a finger is the thing being felt,
 * and an average over the whole visit hides exactly that.
 *
 * ── It must not become the lag it is measuring ────────────────────────────
 *
 * The frame loop reads NO layout. Not one getBoundingClientRect, not one
 * offsetTop, not even scrollY — per-frame layout reads were once 97% of the
 * work strip's frame cost on this very site, and an instrument that costs a
 * frame to measure a frame tells you nothing. Everything positional comes from
 * IntersectionObserver, which the browser computes off the main thread and
 * hands over asynchronously. Scroll position is read inside the scroll event,
 * where the browser has just computed it anyway. The readout repaints twice a
 * second, from three text nodes, outside React.
 *
 * ── Turning it on ─────────────────────────────────────────────────────────
 *
 * `?perf=1` and nothing else. The module is dynamically imported by PerfProbe,
 * so with no flag it is never fetched, never parsed and never run: the site
 * still ships as the site. Scroll the page once, top to bottom, at the speed
 * you would normally read it, then press COPY and paste the report.
 *
 * ── What Safari will not tell us ──────────────────────────────────────────
 *
 * iOS has no `longtask` observer and no `performance.memory`. The report says
 * so rather than printing a zero, because a zero there would read as "no long
 * tasks" when it means "no instrument". Frame timing itself is honest
 * everywhere, and it is the measurement that matters most.
 */

import { entries, totals } from "./webglContexts";

/** How long a bucket of frames covers. Short enough to catch one bad approach. */
const BUCKET_MS = 500;

/** Frames longer than this are what a reader actually perceives as a stutter. */
const JANK_MS = 50;

/** The sections, in page order, and how to find each one. */
const SECTIONS: Array<{ name: string; selector: string }> = [
  { name: "hero", selector: "[data-hero-logo]" },
  { name: "services", selector: "#services" },
  { name: "gallery", selector: '[data-section="gallery"]' },
  { name: "work", selector: "#work" },
  { name: "impact", selector: "main section.h-auto" },
  { name: "seasons", selector: "#seasons" },
  { name: "footer", selector: "footer" },
];

interface Bucket {
  /** Milliseconds since the recorder started. */
  t: number;
  /** Frame durations in this bucket. */
  frames: number[];
  /** Was the reader scrolling during it. */
  scrolled: boolean;
  /** Pixels travelled during it. */
  dy: number;
  /** The section holding most of the screen. */
  section: string;
  /** Live WebGL contexts at the close of the bucket. */
  gl: number;
  /** Long tasks that landed in it, and their total cost. */
  tasks: number;
  taskMs: number;
}

const buckets: Bucket[] = [];
/** Frame durations in the bucket currently open. */
let frames: number[] = [];
let bucketStart = 0;
let scrolledThisBucket = false;
let dyThisBucket = 0;
let lastScrollY = 0;
let tasksThisBucket = 0;
let taskMsThisBucket = 0;

/** Visible fraction per section, kept up to date by IntersectionObserver. */
const ratios = new Map<string, number>();

/** The worst frames of the whole session, with their context. */
const worst: Array<{ t: number; ms: number; section: string; scrolled: boolean }> = [];

let started = 0;
let raf = 0;
let lastFrameAt = 0;
let installed = false;
let hasLongTaskObserver = false;

/** The section currently holding most of the viewport. */
function currentSection(): string {
  let best = "";
  let bestRatio = 0;
  for (const [name, ratio] of ratios) {
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = name;
    }
  }
  return best || "none";
}

/**
 * Live WebGL contexts, asked of the context manager that already tracks them
 * (lib/webglContexts). Taking a context to count contexts would be absurd on a
 * page whose whole problem is that it runs out of them.
 */
function liveContexts(): number {
  try {
    return totals().live;
  } catch {
    return -1; // the census is a nicety, never a reason to fail
  }
}

function closeBucket(at: number) {
  if (frames.length) {
    buckets.push({
      t: Math.round(bucketStart - started),
      frames,
      scrolled: scrolledThisBucket,
      dy: Math.round(dyThisBucket),
      section: currentSection(),
      gl: liveContexts(),
      tasks: tasksThisBucket,
      taskMs: Math.round(taskMsThisBucket),
    });
  }
  frames = [];
  bucketStart = at;
  scrolledThisBucket = false;
  dyThisBucket = 0;
  tasksThisBucket = 0;
  taskMsThisBucket = 0;
}

function tick(now: number) {
  raf = requestAnimationFrame(tick);
  if (lastFrameAt) {
    const dt = now - lastFrameAt;
    // A backgrounded tab delivers one enormous frame on return. That is not
    // jank the reader felt, so it is dropped rather than crowning the report.
    if (dt < 2000) {
      frames.push(dt);
      if (dt >= JANK_MS) {
        worst.push({
          t: Math.round(now - started),
          ms: Math.round(dt),
          section: currentSection(),
          scrolled: scrolledThisBucket,
        });
        // Keep only the worst hundred, so a long session cannot grow forever.
        if (worst.length > 400) {
          worst.sort((a, b) => b.ms - a.ms);
          worst.length = 100;
        }
      }
    }
  }
  lastFrameAt = now;
  if (now - bucketStart >= BUCKET_MS) closeBucket(now);
  paintHud(now);
}

/* ── The readout ───────────────────────────────────────────────────────── */

let hud: HTMLDivElement | null = null;
let hudLine1: Text | null = null;
let hudLine2: Text | null = null;
let hudPaintedAt = 0;

function paintHud(now: number) {
  if (!hudLine1 || !hudLine2 || now - hudPaintedAt < 500) return;
  hudPaintedAt = now;
  const recent = buckets.slice(-2).flatMap((b) => b.frames).concat(frames);
  if (!recent.length) return;
  const fps = Math.round(1000 / (recent.reduce((a, b) => a + b, 0) / recent.length));
  const slowest = Math.round(Math.max(...recent));
  const gl = liveContexts();
  hudLine1.data = `${fps} fps   worst ${slowest}ms`;
  hudLine2.data = `${currentSection()}   gl:${gl < 0 ? "?" : gl}   ${Math.round(
    (now - started) / 1000,
  )}s`;
}

function buildHud() {
  hud = document.createElement("div");
  hud.setAttribute("data-perf-hud", "");
  // Above the page transition (z-10000) and the loading curtain (z-9999):
  // the first seconds after the curtain are part of what is being measured.
  // Top RIGHT: the navbar's hamburger owns the top left and the glass dock
  // owns the bottom right, and a readout sitting on either would be measuring
  // a page the reader cannot drive. The safe-area inset keeps it below a notch.
  hud.style.cssText = [
    "position:fixed",
    "right:8px",
    "top:calc(env(safe-area-inset-top, 0px) + 8px)",
    "z-index:2147483647",
    "font:11px/1.35 ui-monospace,Menlo,monospace",
    "color:#fff",
    "background:rgba(0,0,0,.72)",
    "padding:6px 8px",
    "border-radius:6px",
    "white-space:pre",
    "pointer-events:none",
  ].join(";");

  const l1 = document.createElement("div");
  hudLine1 = document.createTextNode("measuring");
  l1.appendChild(hudLine1);
  const l2 = document.createElement("div");
  l2.style.opacity = "0.75";
  hudLine2 = document.createTextNode("");
  l2.appendChild(hudLine2);

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:6px;margin-top:6px;pointer-events:auto";
  row.appendChild(button("COPY", copyReport));
  row.appendChild(
    button("RESET", () => {
      buckets.length = 0;
      worst.length = 0;
      frames = [];
      started = performance.now();
      bucketStart = started;
    }),
  );

  hud.append(l1, l2, row);
  document.body.appendChild(hud);
}

function button(label: string, onClick: () => void) {
  const b = document.createElement("button");
  b.textContent = label;
  b.style.cssText = [
    "font:10px/1 ui-monospace,monospace",
    "color:#fff",
    "background:rgba(255,255,255,.16)",
    "border:0",
    "border-radius:4px",
    "padding:5px 7px",
    "touch-action:manipulation",
  ].join(";");
  b.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return b;
}

async function copyReport() {
  const text = report();
  try {
    await navigator.clipboard.writeText(text);
    flash("copied");
  } catch {
    // iOS refuses the clipboard outside a trusted gesture in some webviews.
    // Showing the text is the fallback: it can be selected by hand, or
    // screenshotted, which is what a phone reader will do anyway.
    show(text);
  }
}

function flash(msg: string) {
  if (!hudLine1) return;
  const was = hudLine1.data;
  hudLine1.data = msg;
  window.setTimeout(() => {
    if (hudLine1) hudLine1.data = was;
  }, 1200);
}

function show(text: string) {
  const pre = document.createElement("textarea");
  pre.value = text;
  pre.readOnly = true;
  pre.style.cssText = [
    "position:fixed",
    "inset:5vh 4vw",
    "z-index:2147483647",
    "background:#000",
    "color:#0f0",
    "font:10px/1.3 ui-monospace,monospace",
    "padding:10px",
    "border:1px solid #333",
    "border-radius:8px",
  ].join(";");
  pre.addEventListener("dblclick", () => pre.remove());
  document.body.appendChild(pre);
  pre.select();
}

/* ── The report ────────────────────────────────────────────────────────── */

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
  return sorted[i];
}

/** Frames per second from a set of frame durations, at a given quantile. */
function fpsAt(durations: number[], q: number): number {
  const sorted = [...durations].sort((a, b) => a - b);
  const ms = quantile(sorted, q);
  return ms > 0 ? Math.round(1000 / ms) : 0;
}

export function report(): string {
  closeBucket(performance.now());
  const out: string[] = [];
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };
  const w = window as Window & { __gpu?: boolean };

  out.push("=== zuhayrcreative frame report ===");
  out.push(`ua        ${navigator.userAgent}`);
  out.push(
    `screen    ${window.innerWidth}x${window.innerHeight} dpr ${window.devicePixelRatio}`,
  );
  out.push(
    `hw        cores ${nav.hardwareConcurrency ?? "?"}  mem ${
      nav.deviceMemory ?? "?"
    }GB  gpu ${w.__gpu === undefined ? "?" : w.__gpu}`,
  );
  out.push(
    `duration  ${Math.round(
      (performance.now() - started) / 1000,
    )}s   buckets ${buckets.length}   longtask ${
      hasLongTaskObserver ? "yes" : "NOT AVAILABLE (Safari)"
    }`,
  );
  out.push("");

  // Per section, split by whether the reader was moving.
  out.push("section     state      secs   fps50  fps10   worst   jank  gl");
  for (const { name } of SECTIONS) {
    for (const moving of [true, false]) {
      const mine = buckets.filter((b) => b.section === name && b.scrolled === moving);
      if (!mine.length) continue;
      const durations = mine.flatMap((b) => b.frames);
      if (!durations.length) continue;
      const secs = (durations.reduce((a, b) => a + b, 0) / 1000).toFixed(1);
      // fps50 is the median frame; fps10 is the bad tenth, which is what a
      // reader calls "laggy" long before the average moves.
      const janks = durations.filter((d) => d >= JANK_MS).length;
      const gl = Math.max(...mine.map((b) => b.gl));
      out.push(
        [
          name.padEnd(11),
          (moving ? "scrolling" : "still").padEnd(10),
          secs.padStart(5),
          String(fpsAt(durations, 0.5)).padStart(6),
          String(fpsAt(durations, 0.9)).padStart(6),
          `${Math.round(Math.max(...durations))}ms`.padStart(8),
          String(janks).padStart(6),
          String(gl).padStart(4),
        ].join(" "),
      );
    }
  }
  out.push("");
  out.push("fps50 = median frame, fps10 = the worst tenth, jank = frames over 50ms");
  out.push("");

  // The individual frames a reader would have felt.
  const top = [...worst].sort((a, b) => b.ms - a.ms).slice(0, 12);
  if (top.length) {
    out.push("worst frames");
    for (const f of top) {
      out.push(
        `  +${(f.t / 1000).toFixed(1)}s  ${String(f.ms).padStart(5)}ms  ${f.section}${
          f.scrolled ? " (scrolling)" : ""
        }`,
      );
    }
    out.push("");
  }

  if (hasLongTaskObserver) {
    const withTasks = buckets.filter((b) => b.tasks > 0);
    const totalMs = withTasks.reduce((a, b) => a + b.taskMs, 0);
    out.push(
      `long tasks  ${withTasks.reduce((a, b) => a + b.tasks, 0)} totalling ${totalMs}ms`,
    );
    for (const b of withTasks.sort((x, y) => y.taskMs - x.taskMs).slice(0, 8)) {
      out.push(`  +${(b.t / 1000).toFixed(1)}s  ${b.taskMs}ms  ${b.section}`);
    }
    out.push("");
  }

  // WHICH scenes are alive, not merely how many. A context count says the
  // page is loaded up; the labels say what to switch off first.
  try {
    const live = entries().filter((e) => e.ok && !e.reaped && e.connected);
    if (live.length) {
      out.push(`live webgl (${live.length})`);
      for (const e of live) {
        out.push(`  ${e.label.padEnd(22)} ${e.size}${e.lost ? "  CONTEXT LOST" : ""}`);
      }
      out.push("");
    }
  } catch {
    /* the census is a nicety */
  }

  // Scroll smoothness: how far the page moved per bucket while moving. Large,
  // uneven jumps are the signature of a scroll that is being driven rather
  // than followed.
  const moving = buckets.filter((b) => b.scrolled && b.dy !== 0);
  if (moving.length) {
    const dys = moving.map((b) => Math.abs(b.dy)).sort((a, b) => a - b);
    out.push(
      `scroll    ${moving.length} moving buckets, px per ${BUCKET_MS}ms: median ${quantile(
        dys,
        0.5,
      )}, max ${dys[dys.length - 1]}`,
    );
  }

  return out.join("\n");
}

/* ── Install ───────────────────────────────────────────────────────────── */

export function installPerfRecorder() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  started = performance.now();
  bucketStart = started;
  lastScrollY = window.scrollY;

  // Scroll: the position is read HERE, inside the event, where the browser has
  // just computed it. Never in the frame loop.
  window.addEventListener(
    "scroll",
    () => {
      scrolledThisBucket = true;
      const y = window.scrollY;
      dyThisBucket += y - lastScrollY;
      lastScrollY = y;
    },
    { passive: true },
  );
  // Lenis drives the page during a wipe without firing scroll on some paths.
  window.addEventListener("app:scroll-set", () => {
    scrolledThisBucket = true;
  });
  for (const type of ["wheel", "touchmove"] as const) {
    window.addEventListener(type, () => {
      scrolledThisBucket = true;
    }, { passive: true });
  }

  // Which section is on screen, computed by the browser rather than by us.
  const io = new IntersectionObserver(
    (list) => {
      for (const e of list) {
        const name = (e.target as HTMLElement).dataset.perfSection;
        if (name) ratios.set(name, e.intersectionRatio);
      }
    },
    { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
  );
  // Sections mount late now (LazyHydrate), so the list is re-checked rather
  // than captured once at install.
  const attach = () => {
    for (const { name, selector } of SECTIONS) {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el || el.dataset.perfSection) continue;
      el.dataset.perfSection = name;
      io.observe(el);
    }
  };
  attach();
  window.setInterval(attach, 1000);

  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        tasksThisBucket += 1;
        taskMsThisBucket += entry.duration;
      }
    });
    po.observe({ type: "longtask", buffered: true });
    hasLongTaskObserver = true;
  } catch {
    hasLongTaskObserver = false; // Safari
  }

  buildHud();
  raf = requestAnimationFrame(tick);

  // Reachable from a remote debugger as well as from the button.
  (window as Window & { __perfReport?: () => string }).__perfReport = report;
}

export function stopPerfRecorder() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  hud?.remove();
  hud = null;
  installed = false;
}
