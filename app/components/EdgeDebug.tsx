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
 * Three tools, and the third is the one a screenshot can't lie about:
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
 * 3. STRIPES. Six opaque, labelled, 24px colour bands pinned to the very first
 *    and very last pixels the page owns (fixed top:0 / bottom:0, above
 *    everything). They write INTO the bar zone, which turns any screenshot
 *    into a verdict:
 *      - The bar swallows the stripes (they start below / end above it):
 *        the bar is OUTSIDE the page. No CSS can touch it — it is Safari's
 *        chrome backdrop, and the only lever is the colour Safari derives it
 *        from.
 *      - The stripes run to the physical screen edge and the bar sits ON TOP
 *        of them, dimming them: translucent Safari chrome over live content —
 *        working as intended, tune the page not the viewport.
 *      - The stripes reach the edge but the bar appears when they're toggled
 *        off: something in OUR page paints it — hunt the layer.
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
  // Stripes default ON: the question they answer — "who owns the bar zone?" —
  // is the reason anyone opens ?edges=1 at all.
  const [stripes, setStripes] = useState(true);
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
    // Same ?edges gate as the arming effect above, and it is LOAD-BEARING:
    // without it this effect runs for every visitor on mount, rewrites their
    // viewport meta, and — via the measure() below — populates `rows`, which
    // is the very condition that renders the panel. That is how the debug
    // readout ended up on the production site with no flag in the URL.
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

      {/* Labelled bands on the page's outermost pixels — writing INTO the bar
          zone, so a screenshot shows exactly where the page's reach ends. */}
      {stripes && (
        <>
          <EdgeStripes top />
          <EdgeStripes top={false} />
        </>
      )}

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
            <button
              style={{ ...btn, background: stripes ? "#1b7f3b" : "#555" }}
              onClick={() => setStripes((s) => !s)}
            >
              stripes: {stripes ? "on" : "off"}
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

/**
 * Six 24px bands in colours the site never uses, each labelled with the pixel
 * range it occupies measured FROM THE PAGE'S OWN EDGE (fixed top:0 /
 * bottom:0). Opaque on purpose: a translucent Safari chrome dims them, an
 * opaque strip swallows them, and either way the screenshot reads the verdict
 * off the labels — no interpretation needed.
 */
const STRIPE_COLORS = ["#00e676", "#ffee00", "#00e5ff", "#ff4dff", "#ff9100", "#ffffff"];
const STRIPE_H = 24;

function EdgeStripes({ top }: { top: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        [top ? "top" : "bottom"]: 0,
        // Below the readout panel (…647) and the rulers (…646) so the red
        // hairline stays visible as the layout-viewport marker ON the stripes.
        zIndex: 2147483645,
        pointerEvents: "none",
        display: "flex",
        // Stripe 0 hugs the edge in both directions: normal column from the
        // top, reversed column up from the bottom.
        flexDirection: top ? "column" : "column-reverse",
      }}
    >
      {STRIPE_COLORS.map((c, i) => (
        <div
          key={c}
          style={{
            height: STRIPE_H,
            background: c,
            color: "#000",
            font: `700 11px/${STRIPE_H}px ui-monospace, Menlo, monospace`,
            textAlign: "center",
          }}
        >
          {top ? "top" : "bottom"} {i * STRIPE_H}–{(i + 1) * STRIPE_H}px
        </div>
      ))}
    </div>
  );
}

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
