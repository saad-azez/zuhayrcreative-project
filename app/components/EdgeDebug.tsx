"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * On-device diagnostic for the iOS Safari edge strips.
 *
 * Mobile Safari has no reachable console without a Mac and Web Inspector, so
 * this reports to the SCREEN instead. It is mounted in the root layout, but it
 * is completely inert — renders nothing, installs no listeners, measures
 * nothing — unless the URL carries ?edges=1. Nothing reaches real visitors.
 *
 *   https://…/?edges=1
 *
 * Two tools, and the second is the one that actually settles the question:
 *
 * 1. RULERS. A red hairline pinned to the top and bottom of the LAYOUT
 *    VIEWPORT — the box the page is allowed to paint in. If the strip you see
 *    sits OUTSIDE those lines, the page never owned that area and the colour is
 *    Safari tinting its own chrome. If it sits INSIDE, it is our own layout
 *    leaving a gap, and the fix is in our CSS.
 *
 * 2. PAINT LAYERS. Floods each candidate layer with a colour nothing else on
 *    the site uses, so the strip names its own source:
 *      LIME    → <html>, i.e. the canvas / overscroll colour
 *      MAGENTA → <body>
 *      CYAN    → the fixed WebGL background div
 *      white / black / anything else → none of ours. Safari is not sampling
 *      the page at all and is falling back to its own default.
 *
 * The readout carries the numbers that separate "page is inset inside the safe
 * area" from "page is edge to edge": innerHeight vs clientHeight vs
 * screen.height, the visualViewport offsets, and the resolved safe-area insets.
 */

type Row = [label: string, value: string];

const PAINT_CSS = [
  "html { background: #00ff00 !important; }",
  "body { background: #ff00ff !important; }",
  "[data-unicorn-bg] { background: #00ffff !important; }",
  "[data-unicorn-bg] canvas { opacity: 0.15 !important; }",
].join("\n");

/** Resolve env(safe-area-inset-*) by measuring a throwaway element. */
function readSafeAreaInsets() {
  const probe = document.createElement("div");
  probe.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "visibility:hidden",
    "pointer-events:none",
    "padding-top:env(safe-area-inset-top)",
    "padding-right:env(safe-area-inset-right)",
    "padding-bottom:env(safe-area-inset-bottom)",
    "padding-left:env(safe-area-inset-left)",
  ].join(";");
  document.body.appendChild(probe);
  const s = getComputedStyle(probe);
  const out = [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].join(" / ");
  probe.remove();
  return out;
}

/**
 * The colour actually painted at a point. elementFromPoint gives the topmost
 * element, but that element is usually transparent, so walk up until something
 * declares a background it will really paint.
 */
function paintedColorAt(x: number, y: number) {
  let el = document.elementFromPoint(x, y) as HTMLElement | null;
  const first = el ? el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") : "none";
  while (el) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== "transparent" && !bg.startsWith("rgba(0, 0, 0, 0)")) {
      return first + " → " + el.tagName.toLowerCase() + " " + bg;
    }
    el = el.parentElement;
  }
  return first + " → nothing opaque";
}

export default function EdgeDebug() {
  const [painting, setPainting] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [copied, setCopied] = useState(false);
  const [cover, setCover] = useState(true);
  const styleRef = useRef<HTMLStyleElement | null>(null);

  const measure = useCallback(() => {
    const de = document.documentElement;
    const vv = window.visualViewport;
    const bg = document.querySelector("[data-unicorn-bg]");
    const bgRect = bg?.getBoundingClientRect();
    const w = window.innerWidth;
    const h = window.innerHeight;

    setRows([
      ["ua", navigator.userAgent],
      [
        "viewport meta",
        document.querySelector<HTMLMetaElement>('meta[name="viewport"]')?.content ?? "—",
      ],
      [
        "theme-color",
        document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content ?? "—",
      ],
      ["—— canvas readback ——", ""],
      // THE decisive rows. Safari tints its edge strips by sampling the
      // page's outermost rendered pixels (proven on device by the stripes
      // test, 25e9072). The Unicorn canvas reads back BLACK unless its
      // context was created with preserveDrawingBuffer, which the SDK does
      // not do — so layout.tsx patches getContext during parse to force it.
      // These rows say whether that patch took, and what the pixels the
      // sampler sees actually are. Without them, "the fix didn't apply" and
      // "it applied and Safari still won't sample it" look identical.
      [
        "scenes hidden (?nobg)",
        de.hasAttribute("data-nobg") ? "YES — no WebGL on page" : "no — scenes live",
      ],
      [
        "preserveDrawingBuffer",
        (() => {
          const c = bg?.querySelector("canvas");
          if (!c) return "no canvas yet";
          const gl =
            (c.getContext("webgl2") as WebGL2RenderingContext | null) ??
            (c.getContext("webgl") as WebGLRenderingContext | null);
          const attrs = gl?.getContextAttributes?.();
          if (!attrs) return "no GL context";
          return attrs.preserveDrawingBuffer ? "TRUE — patch took" : "false — PATCH MISSED";
        })(),
      ],
      [
        // Reading the canvas's own top-left pixel is exactly what Safari's
        // sampler does. "0,0,0" here means the strips can only ever be black.
        "top pixel readback",
        (() => {
          const c = bg?.querySelector("canvas");
          if (!c) return "no canvas yet";
          try {
            const gl =
              (c.getContext("webgl2") as WebGL2RenderingContext | null) ??
              (c.getContext("webgl") as WebGLRenderingContext | null);
            if (!gl) return "no GL context";
            const px = new Uint8Array(4);
            // WebGL's origin is bottom-left, so this samples the canvas's
            // BOTTOM edge; the row below samples the top.
            gl.readPixels(2, 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
            const top = new Uint8Array(4);
            gl.readPixels(2, gl.drawingBufferHeight - 3, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, top);
            const fmt = (p: Uint8Array) => p[0] + "," + p[1] + "," + p[2];
            return "top " + fmt(top) + "  bottom " + fmt(px);
          } catch (e) {
            return "readback threw: " + String(e).slice(0, 40);
          }
        })(),
      ],
      ["—— sizes ——", ""],
      ["window.inner", w + " x " + h],
      ["doc.client", de.clientWidth + " x " + de.clientHeight],
      ["screen", screen.width + " x " + screen.height],
      ["dpr", String(devicePixelRatio)],
      // innerHeight < screen.height means the page is INSET — Safari kept the
      // strips for itself. Equal means the page owns the whole screen.
      [
        "inner vs screen",
        h + " vs " + screen.height + " → " + (h < screen.height ? "PAGE IS INSET" : "edge to edge"),
      ],
      ["—— visualViewport ——", ""],
      ["vv size", vv ? Math.round(vv.width) + " x " + Math.round(vv.height) : "—"],
      ["vv offset", vv ? "top " + vv.offsetTop + " left " + vv.offsetLeft : "—"],
      ["vv pageTop", vv ? String(vv.pageTop) : "—"],
      ["vv scale", vv ? String(vv.scale) : "—"],
      ["—— safe area ——", ""],
      ["env insets t/r/b/l", readSafeAreaInsets()],
      ["—— colours ——", ""],
      ["html bg", getComputedStyle(de).backgroundColor],
      ["body bg", getComputedStyle(document.body).backgroundColor],
      ["body isolation", getComputedStyle(document.body).isolation],
      ["bg layer", bg ? getComputedStyle(bg).backgroundColor : "NO [data-unicorn-bg]"],
      [
        "bg layer rect",
        bgRect
          ? "top " +
            Math.round(bgRect.top) +
            " h " +
            Math.round(bgRect.height) +
            " bottom " +
            Math.round(bgRect.bottom)
          : "—",
      ],
      // A bg layer whose top is below 0, or whose bottom stops above
      // innerHeight, is leaving a gap for the page background to show through.
      [
        "bg covers viewport?",
        bgRect ? (bgRect.top <= 0 && bgRect.bottom >= h ? "yes" : "NO — GAP") : "—",
      ],
      ["—— painted at edges ——", ""],
      ["top edge (y=0)", paintedColorAt(w / 2, 0)],
      ["bottom edge", paintedColorAt(w / 2, h - 1)],
      ["scrollY", String(window.scrollY)],
      ["measured at", new Date().toLocaleTimeString()],
    ]);
  }, []);

  // Arm only on ?edges=1. Read from location rather than useSearchParams so
  // this needs no Suspense boundary and cannot push the tree to client-side
  // rendering when the flag is absent.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("edges")) return;
    // Deferred to the next frame rather than called straight from the effect
    // body. Two reasons, and they agree: measuring before first paint reads
    // rects that have not settled, and a synchronous setState in an effect is
    // a cascading render the React Compiler rules reject.
    const raf = requestAnimationFrame(measure);
    const vv = window.visualViewport;
    // The toolbar collapsing on scroll is exactly when the insets change, so
    // re-measure on the events that accompany it.
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
    };
  }, [measure]);

  useEffect(() => {
    // Same ?edges gate as the arming effect above. Without it this effect
    // runs for every visitor on mount and its measure() populates `rows` —
    // the very condition that renders the panel — so the debug readout was
    // showing on the production site with no flag in the URL.
    if (!new URLSearchParams(window.location.search).has("edges")) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    const base = meta.content.replace(/,\s*viewport-fit=\w+/g, "");
    meta.content = cover ? base + ", viewport-fit=cover" : base;
    // Safari applies the new viewport on the next frame; re-read so the panel
    // shows what actually changed rather than the pre-toggle numbers.
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [cover, measure]);

  useEffect(() => {
    if (!painting) return;
    const el = document.createElement("style");
    el.textContent = PAINT_CSS;
    document.head.appendChild(el);
    styleRef.current = el;
    return () => {
      el.remove();
      styleRef.current = null;
    };
  }, [painting]);

  if (rows.length === 0) return null;

  const dump = rows.map(([k, v]) => (v ? k + ": " + v : k)).join("\n");

  return (
    <>
      {/* Layout-viewport rulers. Anything visible beyond these is not ours. */}
      <div style={rulerStyle(true)} aria-hidden />
      <div style={rulerStyle(false)} aria-hidden />

      <div
        style={{
          position: "fixed",
          top: "12%",
          left: 0,
          right: 0,
          zIndex: 2147483647,
          // pointer-events off so elementFromPoint samples the PAGE rather than
          // this panel; the buttons opt themselves back in.
          pointerEvents: "none",
          padding: "8px",
          font: "600 10px/1.45 ui-monospace, Menlo, monospace",
          color: "#e8e8e8",
        }}
      >
        <div
          style={{
            background: "rgba(0,0,0,0.86)",
            border: "1px solid #444",
            borderRadius: 8,
            padding: "8px 10px",
            maxHeight: "58vh",
            overflow: "auto",
            pointerEvents: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <button style={btn} onClick={() => setPainting((p) => !p)}>
              {painting ? "un-paint layers" : "paint layers"}
            </button>
            <button
              style={{ ...btn, background: cover ? "#1b7f3b" : "#555" }}
              onClick={() => setCover((c) => !c)}
            >
              fit: {cover ? "cover" : "auto"}
            </button>
            <button style={btn} onClick={measure}>
              re-measure
            </button>
            <button
              style={btn}
              onClick={() => {
                navigator.clipboard?.writeText(dump).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
            >
              {copied ? "copied ✓" : "copy"}
            </button>
          </div>

          {painting && (
            <div style={{ marginBottom: 8, color: "#ffd479" }}>
              lime=html · magenta=body · cyan=bg layer · other=Safari default
            </div>
          )}

          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td
                    style={{
                      color: v ? "#8ab4f8" : "#ffd479",
                      paddingRight: 8,
                      verticalAlign: "top",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {k}
                  </td>
                  <td style={{ wordBreak: "break-all" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

const btn: React.CSSProperties = {
  pointerEvents: "auto",
  font: "600 10px ui-monospace, Menlo, monospace",
  color: "#fff",
  background: "#c4010d",
  border: "none",
  borderRadius: 5,
  padding: "6px 9px",
};

function rulerStyle(top: boolean): React.CSSProperties {
  return {
    position: "fixed",
    left: 0,
    right: 0,
    [top ? "top" : "bottom"]: 0,
    height: 2,
    background: "#ff0000",
    zIndex: 2147483646,
    pointerEvents: "none",
  };
}
