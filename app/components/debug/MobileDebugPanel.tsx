"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  clearLog,
  deviceInfo,
  fmtT,
  getEntries,
  getFps,
  getHistory,
  getOnScreen,
  getPrevSession,
  getSections,
  isEnabled,
  reportText,
  runLayoutAudit,
  subscribe,
  type DebugEntry,
  type Level,
  type SectionStat,
} from "@/app/lib/mobileDebug";
import { KILL_SWITCHES, clearOff, getOff, setOff } from "@/app/lib/killSwitch";

/**
 * The on-screen debug panel for phones (see lib/mobileDebug.ts).
 *
 * A small pill in the bottom-left corner shows the frame rate and the error
 * and warning counts; tapping it opens a sheet with four tabs:
 *
 *   Sections   one card per section: state, size, overflow, canvases and
 *              their memory, lost WebGL contexts, fps while on screen,
 *              long frames, errors. Tap a card to see only its log.
 *   Log        everything, newest first, filterable by kind.
 *   Last load  the log the PREVIOUS load saved before it ended — the only
 *              way to see what happened when the phone killed the tab.
 *   Device     screen, pixel ratio, memory, GPU, network.
 *
 * "Copy" / "Share" hand the whole report over as text, to paste into a
 * message. Rendered only on the client and only when debugging is on, so
 * it never appears in the server HTML. Styled inline so no site CSS reaches
 * it, and marked data-lenis-prevent so its lists scroll on their own.
 */

const noopSubscribe = () => () => {};

type Tab = "sections" | "log" | "prev" | "device";
const FILTERS: ("all" | Level)[] = ["all", "error", "warn", "layout", "perf", "gl", "info"];

const C = {
  error: "#ff5363",
  warn: "#ffb547",
  layout: "#c792ff",
  perf: "#5fd0ff",
  gl: "#6dffb0",
  info: "#9aa3ad",
} as const;

export default function MobileDebugPanel() {
  // False on the server and in the first client render (so hydration
  // matches), then the real answer.
  const on = useSyncExternalStore(noopSubscribe, isEnabled, () => false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("sections");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [only, setOnly] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [toast, setToast] = useState("");
  const [gpu, setGpu] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!isEnabled()) return;
    const un = subscribe(() => setTick((n) => n + 1));
    // The pill's fps figure refreshes on its own clock.
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      un();
      clearInterval(id);
    };
  }, []);

  const entries = getEntries();
  const sections = getSections();
  const errors = entries.filter((e) => e.lvl === "error").length;
  const warns = entries.filter((e) => e.lvl === "warn" || e.lvl === "layout" || e.lvl === "gl").length;
  const prev = getPrevSession();

  let shown: DebugEntry[] = tab === "prev" ? (prev?.entries ?? []) : entries;
  if (only) shown = shown.filter((e) => e.src === only);
  if (filter !== "all") shown = shown.filter((e) => e.lvl === filter);
  shown = shown.slice(-300).reverse();

  if (!on) return null;

  const flash = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 1800);
  };
  const copy = async () => {
    const text = reportText(tab === "prev" ? "previous" : "current");
    try {
      await navigator.clipboard.writeText(text);
      flash("Report copied");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        flash("Report copied");
      } catch {
        flash("Copy blocked — use Share");
      }
      ta.remove();
    }
  };
  const share = async () => {
    const text = reportText(tab === "prev" ? "previous" : "current");
    try {
      await navigator.share({ title: "Mobile debug report", text });
    } catch {
      /* cancelled */
    }
  };

  const fps = getFps();

  return (
    <div data-lenis-prevent data-mdbg style={root}>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} style={pill} aria-label="Open debug panel">
          <span style={{ color: fps && fps < 30 ? C.error : fps < 50 ? C.warn : C.gl }}>{fps || "–"}fps</span>
          <span style={{ color: errors ? C.error : "#777" }}>✖{errors}</span>
          <span style={{ color: warns ? C.warn : "#777" }}>⚠{warns}</span>
          {prev && !prev.clean && prev.visible && <span style={{ color: C.error }}>💥</span>}
          {getOff().length > 0 && <span style={{ color: C.layout }}>off:{getOff().length}</span>}
        </button>
      )}

      {open && (
        <div style={sheet}>
          <div style={bar}>
            {(["sections", "log", "prev", "device"] as Tab[]).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} style={tabBtn(tab === t)}>
                {t === "prev" ? `Last load${prev && !prev.clean && prev.visible ? " 💥" : ""}` : t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <button type="button" onClick={() => setOpen(false)} style={iconBtn} aria-label="Close">
              ✕
            </button>
          </div>

          <div style={bar}>
            <button type="button" onClick={copy} style={smallBtn}>Copy</button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button type="button" onClick={share} style={smallBtn}>Share</button>
            )}
            <button
              type="button"
              onClick={() => {
                runLayoutAudit("manual audit from the panel");
                flash("Layout audited");
              }}
              style={smallBtn}
            >
              Audit layout
            </button>
            <button type="button" onClick={clearLog} style={smallBtn}>Clear</button>
            <span style={{ color: "#888", marginLeft: 4 }}>
              {fps}fps · on screen: {getOnScreen().join(", ") || "–"}
            </span>
          </div>

          {(tab === "log" || tab === "prev") && (
            <div style={bar}>
              {FILTERS.map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f)} style={chip(filter === f, f)}>
                  {f}
                </button>
              ))}
              {only && (
                <button type="button" onClick={() => setOnly(null)} style={chip(true, "info")}>
                  {only} ✕
                </button>
              )}
            </div>
          )}

          <div data-lenis-prevent style={body}>
            {tab === "sections" && (
              <>
                {sections.length === 0 && <div style={{ color: "#888" }}>No sections registered yet.</div>}
                {sections.map((s) => (
                  <SectionCard
                    key={s.name}
                    s={s}
                    onTap={() => {
                      setOnly(s.name);
                      setFilter("all");
                      setTab("log");
                    }}
                  />
                ))}
              </>
            )}

            {tab === "prev" && (
              <>
                <div style={{ marginBottom: 8, color: prev && !prev.clean && prev.visible ? C.error : "#aaa" }}>
                  {prev
                    ? `Previous load ${prev.verdict}. Started ${prev.startedAt}; last heartbeat ${prev.lastBeat}.`
                    : "No previous load saved on this device yet."}
                </div>
                {getHistory().length > 0 && (
                  <div style={{ ...card(false), cursor: "default" }}>
                    <b style={{ color: "#fff" }}>Recent loads (newest first)</b>
                    {getHistory().map((h, i) => (
                      <div
                        key={i}
                        style={{
                          ...row,
                          color: /NOT END|killed|discarded/.test(h.verdict) ? C.error : "#bbb",
                        }}
                      >
                        {h.startedAt.slice(11, 19)} → {h.endedAt.slice(11, 19)}: {h.verdict}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {(tab === "log" || tab === "prev") &&
              shown.map((e, i) => (
                <div key={i} style={row}>
                  <span style={{ color: "#666" }}>{fmtT(e.t)} </span>
                  <span style={{ color: C[e.lvl], fontWeight: 700 }}>{e.lvl.toUpperCase()} </span>
                  <span style={{ color: "#e8e8e8" }}>[{e.src}] </span>
                  <span style={{ color: e.lvl === "info" ? "#c9c9c9" : C[e.lvl] }}>{e.msg}</span>
                  {e.detail && <pre style={pre}>{e.detail}</pre>}
                </div>
              ))}

            {tab === "device" && (
              <>
                <div style={{ ...card(false), cursor: "default" }}>
                  <b style={{ color: "#fff" }}>Kill switches</b>
                  <div style={{ color: "#aaa", margin: "4px 0 8px" }}>
                    Turn one thing off, tap Reload, read the fps pill. Whatever gives the
                    biggest jump is what this phone is paying for. Nothing else changes.
                  </div>
                  {KILL_SWITCHES.map(([key, label]) => {
                    const isOffNow = getOff().includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setOff(key, !isOffNow);
                          setTick((n) => n + 1);
                        }}
                        style={{
                          ...btnBase,
                          display: "flex",
                          width: "100%",
                          textAlign: "left",
                          gap: 8,
                          alignItems: "center",
                          marginBottom: 4,
                          borderColor: isOffNow ? C.error : "#333",
                        }}
                      >
                        <span
                          style={{
                            minWidth: 34,
                            fontWeight: 700,
                            color: isOffNow ? C.error : C.gl,
                          }}
                        >
                          {isOffNow ? "OFF" : "on"}
                        </span>
                        <span>
                          <b>{key}</b> <span style={{ color: "#999" }}>— {label}</span>
                        </span>
                      </button>
                    );
                  })}
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => location.reload()}
                      style={{ ...btnBase, background: "#f2f2f2", color: "#000", fontWeight: 700 }}
                    >
                      Reload to apply
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        clearOff();
                        setTick((n) => n + 1);
                      }}
                      style={btnBase}
                    >
                      Everything on
                    </button>
                  </div>
                </div>
                {Object.entries({ ...deviceInfo(), ...(gpu ?? {}) }).map(([k, v]) => (
                  <div key={k} style={row}>
                    <span style={{ color: "#888" }}>{k}: </span>
                    <span style={{ wordBreak: "break-all" }}>{String(v)}</span>
                  </div>
                ))}
                {!gpu && (
                  <button type="button" onClick={() => setGpu(deviceInfo(true))} style={{ ...smallBtn, marginTop: 8 }}>
                    Read GPU info (takes one WebGL context briefly)
                  </button>
                )}
                <div style={{ color: "#888", marginTop: 10 }}>
                  Turn this panel off on this device: open the site with ?debug=0 (and ?debug=1 to bring it back).
                </div>
              </>
            )}
          </div>
          {toast && <div style={toastStyle}>{toast}</div>}
        </div>
      )}
    </div>
  );
}

function SectionCard({ s, onTap }: { s: SectionStat; onTap: () => void }) {
  const avg = s.fpsN ? Math.round(s.fpsSum / s.fpsN) : null;
  const bad = s.state === "crashed" || s.errors > 0;
  const dot =
    s.state === "crashed" ? C.error : s.visibleNow ? C.gl : s.state === "mounting" ? C.warn : "#666";
  return (
    <button type="button" onClick={onTap} style={card(bad)}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: dot, display: "inline-block" }} />
        <b style={{ color: "#fff" }}>{s.name}</b>
        <span style={{ color: "#888" }}>{s.state}</span>
        <span style={{ flex: 1 }} />
        {s.errors > 0 && <span style={{ color: C.error }}>✖{s.errors}</span>}
        {s.warns > 0 && <span style={{ color: C.warn }}>⚠{s.warns}</span>}
      </div>
      {s.note && <div style={{ color: "#777" }}>{s.note}</div>}
      <div style={{ color: "#bbb" }}>
        {s.overlay ? "overlay" : `${s.width}×${s.height}px`}
        {s.overflowPx > 0 && <span style={{ color: C.layout }}> · overflows {s.overflowPx}px</span>}
        {" · "}canvas {s.canvases} ({s.canvasMB} MB)
        {s.glLost > 0 && <span style={{ color: C.gl }}> · {s.glLost} GL lost</span>}
        {" · "}img {s.images} ({s.imageMB} MB)
        {s.failedResources > 0 && <span style={{ color: C.error }}> · {s.failedResources} failed</span>}
      </div>
      {!s.overlay && (
        <div style={{ color: avg !== null && avg < 30 ? C.perf : "#bbb" }}>
          fps {avg ?? "–"} avg / {s.fpsMin ?? "–"} min · {s.longFrames} long frames
          {s.worstFrameMs > 0 && ` (worst ${Math.round(s.worstFrameMs)}ms)`}
        </div>
      )}
      {s.overflowWho && <div style={{ color: C.layout }}>{s.overflowWho}</div>}
    </button>
  );
}

/* ── Styles (inline: nothing from the site may reach the panel) ── */

const font = "11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const root: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483647,
  pointerEvents: "none",
  font,
  WebkitTextSizeAdjust: "100%",
  textAlign: "left",
  letterSpacing: 0,
  textTransform: "none",
};

const pill: CSSProperties = {
  position: "absolute",
  left: 8,
  bottom: "calc(8px + env(safe-area-inset-bottom))",
  pointerEvents: "auto",
  display: "flex",
  gap: 8,
  padding: "7px 10px",
  borderRadius: 999,
  border: "1px solid #333",
  background: "rgba(8,8,10,0.88)",
  color: "#ddd",
  font,
  fontWeight: 700,
  cursor: "pointer",
};

const sheet: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: "62vh",
  pointerEvents: "auto",
  display: "flex",
  flexDirection: "column",
  background: "rgba(8,8,10,0.96)",
  borderTop: "1px solid #333",
  color: "#ddd",
  paddingBottom: "env(safe-area-inset-bottom)",
};

const bar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 6,
  padding: "6px 8px",
  borderBottom: "1px solid #222",
};

const body: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  overscrollBehavior: "contain",
  WebkitOverflowScrolling: "touch",
  touchAction: "pan-y",
  padding: 8,
};

const row: CSSProperties = {
  padding: "4px 0",
  borderBottom: "1px solid #1c1c1f",
  wordBreak: "break-word",
};

const pre: CSSProperties = {
  margin: "3px 0 0",
  padding: 6,
  background: "#141417",
  color: "#aab",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  font,
  fontSize: 10,
};

const btnBase: CSSProperties = {
  font,
  border: "1px solid #333",
  borderRadius: 6,
  background: "#18181b",
  color: "#ddd",
  padding: "5px 9px",
  cursor: "pointer",
};

const smallBtn = btnBase;
const iconBtn: CSSProperties = { ...btnBase, padding: "5px 11px", fontWeight: 700 };
const tabBtn = (on: boolean): CSSProperties => ({
  ...btnBase,
  background: on ? "#f2f2f2" : "#18181b",
  color: on ? "#000" : "#ddd",
  fontWeight: 700,
});
const chip = (on: boolean, f: string): CSSProperties => ({
  ...btnBase,
  padding: "3px 8px",
  borderColor: on ? (C as Record<string, string>)[f] ?? "#ddd" : "#333",
  color: (C as Record<string, string>)[f] ?? "#ddd",
});
const card = (bad: boolean): CSSProperties => ({
  display: "block",
  width: "100%",
  textAlign: "left",
  font,
  color: "#ddd",
  background: bad ? "rgba(60,0,10,0.6)" : "#121215",
  border: `1px solid ${bad ? "#6a1520" : "#26262b"}`,
  borderRadius: 8,
  padding: 8,
  marginBottom: 6,
  cursor: "pointer",
});
const toastStyle: CSSProperties = {
  position: "absolute",
  top: -36,
  left: "50%",
  transform: "translateX(-50%)",
  background: "#f2f2f2",
  color: "#000",
  padding: "6px 12px",
  borderRadius: 6,
  fontWeight: 700,
};
