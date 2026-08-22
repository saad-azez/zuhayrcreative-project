import type { Viewport } from "next";
import EdgeDebug from "../../components/EdgeDebug";
import EdgeSampler from "../../components/EdgeSampler";
import UnicornBackground from "../../components/UnicornBackground";

/**
 * /edge-test — on-device bisection harness for the Safari edge bars.
 *
 * BASELINE (no flags): a faithful copy of the old zuhayrcreative.org head —
 * plain viewport meta, theme-color #470015, flat maroon body, native scroll,
 * three screens of content. CONFIRMED on device (2026-08-23 04:08): renders
 * edge-to-edge, content behind the status bar, no bars.
 *
 * ROUND 1 (04:11, ?all=1 = vf+cs+os+fx+ld): STILL edge-to-edge. Exonerated:
 * viewport-fit=cover, color-scheme dark, overscroll-behavior none, a fixed
 * 100lvh dummy layer + body isolation, and a loading curtain with scroll
 * lock. The culprit is in the site's real runtime layers instead.
 *
 * ROUND 2 flags — each adds one REAL subsystem:
 *
 *   /edge-test?cv=1    the actual Unicorn WebGL background (SDK + canvas)
 *   /edge-test?sb=1    top backdrop-blur strip (ScrollBlur replica, 110px)
 *   /edge-test?rt=1    root sizing: html height:100%, body min-height flex
 *                      column relative + isolation + text-size-adjust
 *   /edge-test?nb=1    scrollbar hiding on html/body (scrollbar-width: none)
 *   /edge-test?sm=1    EdgeSampler colour strips
 *   /edge-test?mx=1    maximum-scale=5, user-scalable=yes viewport parity
 *
 * Round-1 flags (vf, cs, os, fx, ld) still work; ?all=1 enables everything.
 * Flags combine (?cv=1&rt=1). Add &edges=1 for the measurement panel.
 * Open in order, stop at the first URL that shows the bars.
 */

type Search = { [key: string]: string | string[] | undefined };
type Props = { searchParams: Promise<Search> };

const MAROON = "#470015";

const FLAG_KEYS = [
  "vf",
  "cs",
  "os",
  "fx",
  "ld",
  "cv",
  "sb",
  "rt",
  "nb",
  "sm",
  "mx",
] as const;
type Flag = (typeof FLAG_KEYS)[number];

async function readFlags(searchParams: Props["searchParams"]) {
  const q = await searchParams;
  const all = q.all !== undefined;
  return Object.fromEntries(
    FLAG_KEYS.map((k) => [k, all || q[k] !== undefined]),
  ) as Record<Flag, boolean>;
}

export async function generateViewport({
  searchParams,
}: Props): Promise<Viewport> {
  const f = await readFlags(searchParams);
  return {
    width: "device-width",
    initialScale: 1,
    themeColor: MAROON,
    ...(f.vf ? { viewportFit: "cover" as const } : {}),
    ...(f.cs ? { colorScheme: "dark" as const } : {}),
    ...(f.mx ? { maximumScale: 5, userScalable: true } : {}),
  };
}

const sectionStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  gap: 12,
  fontFamily: "ui-monospace, Menlo, monospace",
};

export default async function EdgeTestPage({ searchParams }: Props) {
  const f = await readFlags(searchParams);
  const active = FLAG_KEYS.filter((k) => f[k]);

  return (
    <main>
      {f.os && <style>{`html, body { overscroll-behavior: none; }`}</style>}
      {f.rt && (
        <style>{`
          html { height: 100%; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
          body { min-height: 100%; display: flex; flex-direction: column; position: relative; isolation: isolate; }
        `}</style>
      )}
      {f.nb && (
        <style>{`
          html, body { -ms-overflow-style: none !important; scrollbar-width: none !important; }
          html::-webkit-scrollbar, body::-webkit-scrollbar { display: none !important; }
        `}</style>
      )}
      {f.fx && (
        <>
          <style>{`body { isolation: isolate; position: relative; }`}</style>
          <div
            aria-hidden
            style={{
              position: "fixed",
              inset: 0,
              height: "100lvh",
              zIndex: -10,
              background:
                "radial-gradient(120% 120% at 50% 30%, #5c0620 0%, #470015 60%, #2b000d 100%)",
            }}
          />
        </>
      )}
      {/* The real shared WebGL background, SDK and all — z -10, fixed. Needs
          rt's body isolation to layer the same way as on the main site, but
          renders (and can box the page in) without it too. */}
      {f.cv && <UnicornBackground />}
      {f.sb && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            top: 0,
            height: 110,
            zIndex: 80,
            pointerEvents: "none",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            WebkitMaskImage:
              "linear-gradient(to bottom, #000 0%, #000 30%, transparent 100%)",
            maskImage:
              "linear-gradient(to bottom, #000 0%, #000 30%, transparent 100%)",
          }}
        />
      )}
      {f.sm && <EdgeSampler />}
      {f.ld && (
        <>
          <div
            id="lab-curtain"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "#0b0106",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontFamily: "ui-monospace, Menlo, monospace",
            }}
          >
            loading curtain (2.5s)…
          </div>
          <script
            dangerouslySetInnerHTML={{
              __html:
                "document.documentElement.style.overflow='hidden';setTimeout(function(){document.documentElement.style.overflow='';var c=document.getElementById('lab-curtain');if(c)c.remove();},2500);",
            }}
          />
        </>
      )}

      {/* Marker on the page's very first pixels: if the device is edge-to-edge
          this line sits UNDER the clock; if the page is boxed in, it starts
          below the top bar. */}
      <div
        style={{
          padding: "8px 0 4px",
          textAlign: "center",
          fontFamily: "ui-monospace, Menlo, monospace",
          fontSize: 12,
          background: "#5c0620",
        }}
      >
        ▲ PAGE TOP — first pixels of the page ▲
      </div>

      <section style={sectionStyle}>
        <h1 style={{ fontSize: 28, margin: 0 }}>EDGE LAB</h1>
        <p style={{ margin: 0 }}>
          flags: {active.length ? active.join(", ") : "none (old-site baseline)"}
        </p>
        <p style={{ margin: 0, opacity: 0.7, fontSize: 12 }}>
          scroll down — 3 screens
        </p>
      </section>
      <section style={{ ...sectionStyle, background: f.cv ? "transparent" : "#3a0011" }}>
        <p style={{ fontSize: 22, margin: 0 }}>SECTION 2</p>
      </section>
      <section style={{ ...sectionStyle, background: f.cv ? "transparent" : "#2b000d" }}>
        <p style={{ fontSize: 22, margin: 0 }}>SECTION 3</p>
      </section>

      <div
        style={{
          padding: "4px 0 8px",
          textAlign: "center",
          fontFamily: "ui-monospace, Menlo, monospace",
          fontSize: 12,
          background: "#5c0620",
        }}
      >
        ▼ PAGE BOTTOM — last pixels of the page ▼
      </div>

      <EdgeDebug />
    </main>
  );
}
