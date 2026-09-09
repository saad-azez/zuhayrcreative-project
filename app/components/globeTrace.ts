"use client";

/**
 * Load trace for the Seasons globe — a stopwatch on the console.
 *
 * The globe is the page's one heavy section: its own JS chunk, a WebGL
 * context, 252 tiles and four textures, all of it held back until the reader
 * is on their way to it (SeasonsGlobeLazy). When it takes a while to appear,
 * the question is always WHICH of those it is waiting on, and that cannot be
 * answered from the outside — the section shows nothing at all until the very
 * last of them is ready, so a slow chunk and a slow texture look identical.
 *
 * So every step marks itself here and the whole thing prints as one group:
 * when the code was warmed, when the reader came close enough to mount it,
 * when each texture was asked for and how long it took, and when the first
 * frame was actually drawn. The gap that is large is the problem.
 *
 * ── Turning it on ──
 *   • development: on by default
 *   • anywhere, including a deployed build:
 *       add `?debug=globe` to the URL, or run
 *       `localStorage.setItem("debug:globe", "1")` and reload
 *   • off again: `localStorage.removeItem("debug:globe")`
 *
 * It costs nothing when off — every call returns before it does any work, and
 * nothing here holds a reference to anything the page would otherwise free.
 */

const PREFIX = "%c[globe]";
const STYLE = "color:#c4010d;font-weight:600";

let enabled: boolean | null = null;

/** Whether to trace. Resolved once, on the first call, on the client only. */
function on(): boolean {
  if (enabled !== null) return enabled;
  if (typeof window === "undefined") return false;
  let flagged = false;
  try {
    flagged =
      new URLSearchParams(window.location.search).get("debug") === "globe" ||
      window.localStorage.getItem("debug:globe") === "1";
  } catch {
    // A blocked localStorage (private mode, site-data off) is not a reason to
    // fail; the URL flag and the dev default still decide.
  }
  enabled = flagged || process.env.NODE_ENV !== "production";
  return enabled;
}

/** Milliseconds since the first mark, so every line reads against one clock. */
let t0 = 0;
function elapsed(): number {
  const now = performance.now();
  if (t0 === 0) t0 = now;
  return Math.round(now - t0);
}

/** The marks so far, for the summary at the end. */
const marks: Array<{ label: string; at: number }> = [];

/**
 * Long tasks — anything that held the main thread for 50ms or more.
 *
 * A step's duration on its own cannot say WHY it was slow: waiting on the
 * network and being starved behind other JavaScript both just look like time
 * passing. This separates them. If a gap is mostly long tasks, the page was
 * busy and the globe was queued behind it; if a gap has almost none, the
 * globe was waiting on something outside the main thread.
 */
const longTasks: Array<{ at: number; ms: number }> = [];
let watching = false;
function watchLongTasks(): void {
  if (watching || typeof PerformanceObserver === "undefined") return;
  watching = true;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        longTasks.push({ at: Math.round(e.startTime - t0), ms: Math.round(e.duration) });
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {
    // Not every engine ships longtask; the clock still works without it.
  }
}

/** Blocking time inside a window, and the worst offenders in it. */
function blockingIn(from: number, to: number) {
  const inWindow = longTasks.filter((t) => t.at + t.ms > from && t.at < to);
  const total = inWindow.reduce((n, t) => n + Math.min(t.ms, to - t.at), 0);
  return { total: Math.round(total), worst: inWindow.sort((a, b) => b.ms - a.ms).slice(0, 5) };
}

/**
 * One step of the load. `note` is the human part — a size, a count, a reason.
 */
export function globeMark(label: string, note?: string): void {
  if (!on()) return;
  watchLongTasks();
  const at = elapsed();
  const prev = marks[marks.length - 1];
  marks.push({ label, at });
  const delta = prev ? ` (+${at - prev.at}ms since ${prev.label})` : "";
  console.log(
    `${PREFIX} %c+${at}ms%c ${label}${note ? ` — ${note}` : ""}%c${delta}`,
    STYLE,
    "color:#888",
    "color:inherit",
    "color:#888",
  );
}

/**
 * What the browser itself recorded for a set of URLs: bytes over the wire and
 * how long each took. `transferSize` of 0 with a real body is a cache hit —
 * which is the answer to "did warming the code warm the pictures too" (it does
 * not; only the chunk is prefetched, the textures are fetched at mount).
 */
export function globeResources(
  match: RegExp,
  label = "resources",
  /** Name of an earlier mark; the wait since it is judged against the bytes. */
  sinceLabel?: string,
): void {
  if (!on()) return;
  let rows: Array<Record<string, string | number>> = [];
  try {
    rows = performance
      .getEntriesByType("resource")
      .filter((e) => match.test(e.name))
      .map((e) => {
        const r = e as PerformanceResourceTiming;
        const kb = (n: number) => `${Math.round(n / 1024)} KB`;
        return {
          file: r.name.split("/").pop()?.split("?")[0] ?? r.name,
          "from cache": r.transferSize === 0 && r.decodedBodySize > 0 ? "yes" : "no",
          "over the wire": kb(r.transferSize),
          decoded: kb(r.decodedBodySize),
          ms: Math.round(r.duration),
          "started at": `${Math.round(r.startTime - t0)}ms`,
        };
      });
  } catch {
    return;
  }
  if (rows.length === 0) {
    console.log(`${PREFIX} %c${label}: nothing recorded yet`, STYLE, "color:#888");
    return;
  }
  console.log(`${PREFIX} %c${label}`, STYLE, "color:inherit");
  console.table(rows);

  // The verdict. The table above is the evidence; this is the sentence, so
  // the console answers the question on its own instead of being read.
  const bytes = rows.reduce((n, r) => n + Number(String(r["over the wire"]).replace(/[^\d]/g, "")), 0);
  const cached = rows.every((r) => r["from cache"] === "yes");
  const since = sinceLabel ? marks.find((m) => m.label === sinceLabel) : undefined;
  const waited = since ? elapsed() - since.at : null;
  const slowest = rows.reduce((a, r) => (Number(r.ms) > Number(a.ms) ? r : a), rows[0]);
  if (cached) {
    console.log(
      `${PREFIX} %cthese came from cache — this visit did not pay for them`,
      STYLE,
      "color:inherit",
    );
    return;
  }
  console.log(
    `${PREFIX} %c${bytes} KB over the wire${waited === null ? "" : `, and the scene was held ${waited}ms waiting for it`} — slowest: ${slowest.file} at ${slowest.ms}ms`,
    STYLE,
    "color:inherit",
  );
  if (waited !== null && waited > 800) {
    console.warn(
      `${PREFIX} %cTHIS is the wait. The globe's code is warmed during idle time, but these files are not: three.js asks for them only when the section mounts, and <Suspense> shows nothing until every one has landed. They are ${bytes} KB of 2000x2000 PNG drawn as ~40px tiles.`,
      STYLE,
      "color:inherit",
    );
  }
}

/**
 * The closing summary: every step against the same clock, and the two numbers
 * that matter — how long the reader waited from the moment the section began
 * mounting, and where that time went.
 */
export function globeSummary(): void {
  if (!on() || marks.length === 0) return;
  const from = marks.find((m) => m.label === "approach: mounting");
  const last = marks[marks.length - 1];
  console.log(`${PREFIX} %csummary`, STYLE, "color:inherit");
  console.table(
    marks.map((m, i) => ({
      step: m.label,
      at: `${m.at}ms`,
      took: i === 0 ? "—" : `${m.at - marks[i - 1].at}ms`,
    })),
  );
  if (!from) return;
  const waited = last.at - from.at;
  console.log(
    `${PREFIX} %cthe reader waited ${waited}ms from the section mounting to the first frame`,
    STYLE,
    "color:inherit",
  );

  // Where that wait went: blocked behind other JavaScript, or waiting on
  // something that is not the main thread at all.
  const b = blockingIn(from.at, last.at);
  const share = waited > 0 ? Math.round((b.total / waited) * 100) : 0;
  console.log(
    `${PREFIX} %cof that, ${b.total}ms (${share}%) was the main thread blocked by long tasks`,
    STYLE,
    "color:inherit",
  );
  if (b.worst.length) {
    console.log(
      `${PREFIX} %clongest blocks in the wait: ${b.worst.map((t) => `${t.ms}ms at +${t.at}ms`).join(", ")}`,
      STYLE,
      "color:#888",
    );
  }
  // The single biggest step in the wait, named. A percentage of blocking says
  // how the time was spent; this says WHAT was spending it, which is the thing
  // worth acting on.
  const steps = marks
    .filter((m) => m.at >= from.at)
    .map((m, i, a) => (i === 0 ? null : { label: m.label, ms: m.at - a[i - 1].at }))
    .filter(Boolean) as Array<{ label: string; ms: number }>;
  const biggest = steps.reduce((a, x) => (x.ms > a.ms ? x : a), { label: "-", ms: 0 });
  console.log(
    `${PREFIX} %cthe biggest single step was "${biggest.label}" at ${biggest.ms}ms — ${MEANING[biggest.label] ?? "see the table above"}`,
    STYLE,
    "color:inherit",
  );
  if (share >= 50) {
    console.warn(
      `${PREFIX} %cMost of the wait was the main thread being held by OTHER work. The globe was queued behind whatever else is still animating when you arrive, so its own steps are not the thing to fix.`,
      STYLE,
      "color:inherit",
    );
  }
}

/** What each step actually is, so the console does not need interpreting. */
const MEANING: Record<string, string> = {
  "chunk: requested": "downloading the globe's own JavaScript",
  "chunk: ready": "downloading the globe's own JavaScript",
  "section: React rendering it": "React reaching the section after the approach fired",
  "section: DOM committed": "React building and committing the section's markup",
  "frameloop: allowed to run": "waiting for the section to be properly in view",
  "textures: requested":
    "react-three-fiber measuring the canvas before it will render a scene into it",
  "canvas: WebGL context ready": "creating the WebGL context",
  "textures: all ready": "fetching and decoding the four photographs",
  "FIRST FRAME DRAWN":
    "building the scene — 252 tiles, two meshes each — and compiling its shaders",
};
