import type { Viewport } from "next";
import EdgeDebug from "../../components/EdgeDebug";

/**
 * /edge-test — on-device bisection harness for the Safari edge bars.
 *
 * BASELINE (no flags): a faithful copy of the old zuhayrcreative.org head —
 * plain viewport meta, theme-color #470015, flat maroon body, native scroll,
 * three screens of content. On the client's device the old site renders
 * EDGE-TO-EDGE (screenshot 2026-08-23 03:56: page content behind the status
 * bar and around the URL pill), so this baseline is expected to as well.
 *
 * Each flag adds back ONE behaviour the main site has and the old site does
 * not. Open the URLs in order and stop at the first one where the bars
 * appear — that flag is the culprit:
 *
 *   /edge-test          baseline, no flags
 *   /edge-test?all=1    every suspect at once (sanity: should show bars if
 *                       any single flag can)
 *   /edge-test?os=1     overscroll-behavior: none on html+body
 *   /edge-test?ld=1     full-screen loading curtain for 2.5s + scroll lock
 *   /edge-test?cs=1     color-scheme: dark meta
 *   /edge-test?vf=1     viewport-fit=cover
 *   /edge-test?fx=1     fixed 100lvh background layer + body isolation
 *
 * Flags combine (?os=1&cs=1). Add &edges=1 for the measurement panel.
 */

type Search = { [key: string]: string | string[] | undefined };
type Props = { searchParams: Promise<Search> };

const MAROON = "#470015";

async function readFlags(searchParams: Props["searchParams"]) {
  const q = await searchParams;
  const all = q.all !== undefined;
  const on = (k: string) => all || q[k] !== undefined;
  return {
    vf: on("vf"),
    cs: on("cs"),
    os: on("os"),
    fx: on("fx"),
    ld: on("ld"),
  };
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
  const active = Object.entries(f)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return (
    <main>
      {f.os && (
        <style>{`html, body { overscroll-behavior: none; }`}</style>
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
      <section style={{ ...sectionStyle, background: "#3a0011" }}>
        <p style={{ fontSize: 22, margin: 0 }}>SECTION 2</p>
      </section>
      <section style={{ ...sectionStyle, background: "#2b000d" }}>
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
