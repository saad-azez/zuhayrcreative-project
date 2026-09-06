"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import {
  CLIP_RATIO,
  flareBand,
  createRailTunnel,
  type RailTunnel,
  type TunnelSlat,
} from "./railTunnel";
import { useSplashHover } from "./useSplashHover";
import {
  createPixelCaptionHover,
  type PixelCaptionHover,
} from "./pixelCaptionHover";
import { useImageTrail, TRAIL_HIDDEN_CLIP } from "@/app/animations/useImageTrail";
import ChromaticMetal from "./ChromaticMetal";
import "@/app/styles/case-strip.css";
import "@/app/styles/works-strip.css";
// Only for the lightbox (.wrail__lightbox*) — the enlarged click-to-open view
// this section kept when the rail itself went. Everything else in the file
// targets .wrail DOM that no longer exists on the page, so it is inert.
import "@/app/styles/works-rail.css";

/**
 * The work section: the case strip's layout and motion (see CaseStrip.tsx —
 * the drive, the split, and the flare are copied from there, deliberately NOT
 * shared, so the case study above can be reshaped without dragging this section
 * along), carrying the work content the old whip rail had:
 *
 *   - the "Selected Work" head;
 *   - a caption on each plate naming its project;
 *   - click-to-open — the site-wide repeating image trail flies the picture
 *     into the enlarged view with its year / name / service, exactly as the
 *     rail did (the lightbox markup and its styles are reused wholesale).
 *
 * What it does NOT bring back is any of the rail's own styling: no slats, no
 * perspective volume, no dark scrim — the strip stays the white sheet.
 */

interface Project {
  src: string;
  name: string;
  service: string;
  year: string;
}

/**
 * ⚠️ PLACEHOLDER projects — the work section's eight images, unchanged from
 * the rail (it cycled these same plates). Swap `src`/`name`/`service`/`year`
 * for the real work.
 */
/**
 * The curved screen's depth: extra plate height at the window edge, quadratic
 * from the centre. One number feeding BOTH sides of the DOM/GL seam — the
 * per-plate cylinder projection (perspective + rotateY) and the shader's arc
 * (uArcBow) — so they can never disagree. 0.1 is subtle, 0.25 theatrical.
 */
const STRIP_BOW = 0.2;

/**
 * Inner counter-parallax — the rail's, restored.
 *
 * The picture drifts against its bar as the bar crosses the window, so a bar
 * reads as a WINDOW onto something behind the page rather than as a printed
 * card sliding past. `PARALLAX` is the swing either side of centre as a
 * fraction of bar width; `OVERSCAN` is how much wider than the bar the
 * picture is drawn so that swing never pulls an edge into view.
 *
 * The two are a pair — PARALLAX must stay comfortably under (OVERSCAN-1)/2 —
 * and they are a THREE-way pair here, because .wstrip__shift in the
 * stylesheet has to be the same box (see the note there) and the bake below
 * has to crop the picture exactly as that box does.
 */
const PARALLAX = 0.17;
const OVERSCAN = 1.4;

const PROJECTS: Project[] = [
  { src: "/club/slide-1.jpg", name: "Forma Digital", service: "Brand Identity", year: "2026" },
  { src: "/club/slide-2.jpg", name: "Nero Vision", service: "Motion Design", year: "2025" },
  { src: "/club/slide-3.jpg", name: "Lumina Arc", service: "Web Experience", year: "2025" },
  { src: "/club/slide-4.jpg", name: "Atlas Foundry", service: "Brand Systems", year: "2024" },
  { src: "/club/slide-5.jpg", name: "Halo Studio", service: "Creative Direction", year: "2024" },
  { src: "/club/slide-6.jpg", name: "Drift Labs", service: "AI Automation", year: "2026" },
  { src: "/club/slide-7.jpg", name: "Solace", service: "Web Design", year: "2025" },
  { src: "/club/slide-8.jpg", name: "Vanta Goods", service: "Brand Identity", year: "2023" },
];

export default function WorksStrip() {
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const tunnelRef = useRef<RailTunnel | null>(null);
  // Set during a drag so releasing over a plate doesn't open it.
  const draggedRef = useRef(false);
  // Read by the drive each frame — the strip holds still while the enlarged
  // view is open, so the closing trail flies back to a plate that hasn't
  // drifted on from where the clones are aiming.
  const frozenRef = useRef(false);

  const trail = useImageTrail();
  const lightboxRef = useRef<HTMLDivElement>(null);
  const lightboxImgRef = useRef<HTMLImageElement>(null);
  const lightboxCapRef = useRef<HTMLDivElement>(null);
  const { isTouch, prefersReducedMotion } = useDeviceDetect();
  const [selected, setSelected] = useState<number | null>(null);

  // The drive runs once and never re-subscribes, but `isTouch` only becomes
  // true after mount (useDeviceDetect starts on SSR defaults). A ref carries
  // the real value in without making the drive depend on it — steering is the
  // one thing in there that a touch device must not do.
  const isTouchRef = useRef(false);
  useEffect(() => {
    isTouchRef.current = isTouch;
  }, [isTouch]);

  // One pixel-sweep controller per caption, created the first time its plate
  // is hovered. WeakMap so an unmounting plate takes its controller with it.
  const captionFx = useRef(new WeakMap<HTMLElement, PixelCaptionHover>());

  /**
   * The caption's hover pixelation — the gallery headline's block sweep, run
   * toward the brand red on enter and back to white on leave. The colour
   * itself is flipped on the DOM text up front via `.is-hot` (the text is
   * hidden behind the canvas for the whole sweep, so the flip is invisible
   * until the sharp frame hands back — in exactly that colour).
   */
  const hoverCaption = useCallback(
    (entering: boolean) => (e: React.PointerEvent<HTMLElement>) => {
      if (isTouch) return; // no hover to speak of
      // A cursor sweeping past mid-drag is steering, not focusing.
      if (entering && stageRef.current?.classList.contains("is-grabbing"))
        return;
      const meta = e.currentTarget.querySelector<HTMLElement>(".wstrip__meta");
      if (!meta) return;
      meta.classList.toggle("is-hot", entering);
      if (prefersReducedMotion) return; // colour flip alone
      let fx = captionFx.current.get(meta);
      if (!fx) {
        fx = createPixelCaptionHover(
          meta,
          // Only the rendered spans — the service line is display:none and
          // would measure at 0,0, splattering its glyphs into the corner.
          (Array.from(meta.children) as HTMLElement[]).filter(
            (el) => el.offsetParent !== null,
          ),
        );
        captionFx.current.set(meta, fx);
      }
      fx.play(entering ? "#c4010d" : "#ffffff");
    },
    [isTouch, prefersReducedMotion],
  );

  useSplashHover(lightboxRef, selected !== null);

  // ── Enlarged view — copied from the rail, unchanged ──────────────────

  useEffect(() => {
    if (selected === null) return;
    document.body.style.overflow = "hidden";
    window.dispatchEvent(new Event("app:scroll-lock"));
    return () => {
      document.body.style.overflow = "";
      window.dispatchEvent(new Event("app:scroll-unlock"));
    };
  }, [selected]);

  // Entrance: the repeating image trail runs from the clicked plate to the
  // enlarged image, which wipes on as the leading clone lands. Opacity is
  // handled here rather than by the trail — the stylesheet parks the image at
  // 0 so there is no one-frame flash at the final position.
  useEffect(() => {
    if (selected === null) return;
    const img = lightboxImgRef.current;
    if (!img) return;
    img.style.opacity = "1";
    if (prefersReducedMotion) {
      img.style.clipPath = "none";
      return;
    }
    trail.enter(img, PROJECTS[selected].src, lightboxCapRef.current);
  }, [selected, prefersReducedMotion, trail]);

  // Exit: trail back out to the plate, then unmount once the image has wiped
  // off — the caller must stay mounted for the animation to have a subject.
  const closeLightbox = useCallback(() => {
    const img = lightboxImgRef.current;
    if (selected === null) return;
    if (prefersReducedMotion || !img) {
      frozenRef.current = false;
      setSelected(null);
      return;
    }
    trail.exit(
      img,
      PROJECTS[selected].src,
      () => setSelected(null),
      // Resume the drift only once the last clone has landed on the plate.
      () => {
        frozenRef.current = false;
      },
    );
  }, [selected, prefersReducedMotion, trail]);

  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, closeLightbox]);

  const open = useCallback(
    (i: number) => (e: React.PointerEvent<HTMLElement>) => {
      if (draggedRef.current) return; // the pointerup that ends a drag
      // Hand over the ELEMENT, not a rect — the strip never stops drifting, so
      // the hook re-measures the plate at play time.
      trail.captureOrigin(e.currentTarget as HTMLElement);
      frozenRef.current = true;
      window.dispatchEvent(
        new CustomEvent("app:splash", {
          detail: { x: e.clientX, y: e.clientY },
        }),
      );
      setSelected(i);
    },
    [trail],
  );

  // ── The strip drive — CaseStrip's, plus the freeze and the drag/click
  //    disambiguation the openable plates need ─────────────────────────
  useEffect(() => {
    const stage = stageRef.current;
    const track = trackRef.current;
    const canvas = glRef.current;
    if (!stage || !track || !canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tunnel = reduced ? null : createRailTunnel(canvas);
    tunnelRef.current = tunnel;

    const plates = Array.from(
      track.querySelectorAll<HTMLElement>("[data-plate]"),
    );
    const imgs = plates.map((p) => p.querySelector("img"));
    // The overscanned box the picture parallaxes inside — see PARALLAX.
    const shifts = plates.map((p) =>
      p.querySelector<HTMLElement>(".wstrip__shift"),
    );
    /** 1 where a bar is off screen and has been dropped from paint. */
    const culled = new Uint8Array(plates.length);

    // ── Baked plates ─────────────────────────────────────────────────
    // The GL tail redraws a plate from its TEXTURE, and the texture used to
    // be the bare <img> — so the caption and its scrim, which live in the
    // DOM, stopped dead at the clip seam: the scrim's gradient cut off in a
    // hard vertical line and the type never entered the flare. Each unique
    // project is instead composed once — picture (cover-cropped exactly as
    // the DOM crops it), scrim, number, name — into a canvas at the plate's
    // rendered size, and THAT is what the tunnel warps, so the whole plate
    // bends and disperses through the brand ramp as one surface.
    //
    // The caption is TRACED from its live DOM twin (rects, computed fonts,
    // letter-spacing, colors) rather than restated, so the two sides of the
    // seam cannot drift apart when the CSS is tuned. Waits on fonts and on
    // the images' decode; until then the tail falls back to the bare image.
    //
    // ── …and baked TWICE, once per window edge ──
    // The picture now parallaxes inside its bar (see PARALLAX), so a single
    // bake would hand the flare a differently-framed copy of the photo than
    // its DOM twin is showing and the handoff would ghost. Two are enough, and
    // only two, because the drive PINS the drift at its extreme before any of
    // a bar can belong to GL (see dTail in the frame loop) — so a bar handing
    // over at the left rim is always at +PARALLAX and one at the right rim
    // always at -PARALLAX, whatever it was doing on the way there.
    //
    // That pin is load-bearing, not tidiness. The tail claims a bar when its
    // trailing edge reaches the clip line, and for a 37vw phone bar that is
    // while the bar's centre is still barely off the middle of the screen —
    // nowhere near the rim. Baking "the framing at the rim" and trusting the
    // tail to only ever see the rim is wrong by ~20px there, and it lands as a
    // hard vertical step down the middle of the picture.
    //
    // The caption, the scrim and the glass are drawn at plate coordinates in
    // BOTH — they belong to the bar, not to the picture, and must not travel
    // with it.
    const bakesL: (HTMLCanvasElement | null)[] = new Array(
      PROJECTS.length,
    ).fill(null);
    const bakesR: (HTMLCanvasElement | null)[] = new Array(
      PROJECTS.length,
    ).fill(null);
    let bakeToken = 0;
    const bake = async () => {
      if (!tunnel) return;
      const token = ++bakeToken;
      await document.fonts.ready;
      await Promise.all(
        imgs
          .slice(0, PROJECTS.length)
          .map((im) => im?.decode().catch(() => {})),
      );
      if (token !== bakeToken) return; // superseded by a resize
      // Capped at 1 on a phone. A bar there is 37vw and nearly the full stage
      // tall, so a dpr-2 bake is a ~290x1600 canvas PER PROJECT — and there
      // are now two of them each. The tail is a warped, dispersed sliver at
      // the very rim of the screen; it does not repay 4x the texture memory,
      // and the upload cost was a visible hitch as the section came into view.
      // Capped harder on a phone. A bar there is 37vw and nearly the whole
      // stage tall, so a dpr-2 bake is a ~290x1600 canvas per project — and
      // there are two of them each now, which at dpr 2 is ~30MB of texture on
      // the device least able to spare it. The tail is a warped, dispersed
      // sliver at the rim; 1.5 is indistinguishable there and costs 44% less.
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        window.innerWidth <= 767 ? 1.5 : 2,
      );
      for (let i = 0; i < PROJECTS.length; i++) {
        const plate = plates[i];
        const im = imgs[i];
        if (!plate || !im || !im.naturalWidth) continue;
        // UNTRANSFORMED size — the plates carry the arc's skew/scale as a
        // transform, and the GL rects are untransformed too (the shader bows
        // them); a BCR here would bake the bounding box of the skewed plate
        // and the texture would no longer match its rect.
        const pw = plate.offsetWidth;
        const ph = plate.offsetHeight;
        if (pw < 1 || ph < 1) continue;

        /**
         * Compose one bar at a given parallax shift, in px, positive = the
         * picture pushed right inside its bar. Everything but the picture is
         * drawn at plate coordinates and so is identical between the two.
         */
        const compose = (shift: number) => {
          // A fresh element every time on purpose: the tunnel uploads a source
          // once and keys the texture on the element, so repainting an old
          // canvas would leave a stale texture on the GPU.
          const c = document.createElement("canvas");
          c.width = Math.round(pw * dpr);
          c.height = Math.round(ph * dpr);
          const ctx = c.getContext("2d");
          if (!ctx) return null;
          ctx.scale(dpr, dpr);

          // object-fit: cover — the same crop the DOM applies. The box is the
          // OVERSCANNED one (.wstrip__shift), not the bar: that is the element
          // the DOM sizes its <img> against, so cropping to the bar here would
          // frame the photo differently on the two sides of the seam. Drawn at
          // the shift the bar's screen position calls for.
          const bw = pw * OVERSCAN;
          const bx = -((OVERSCAN - 1) / 2) * pw + shift;
          const ia = im.naturalWidth / im.naturalHeight;
          const ba = bw / ph;
          let sw = im.naturalWidth;
          let sh = im.naturalHeight;
          let sx = 0;
          let sy = 0;
          if (ia > ba) {
            sw = im.naturalHeight * ba;
            sx = (im.naturalWidth - sw) / 2;
          } else {
            sh = im.naturalWidth / ba;
            sy = (im.naturalHeight - sh) / 2;
          }
          ctx.drawImage(im, sx, sy, sw, sh, bx, 0, bw, ph);

          // ── The glass, baked in ──
          // The same film .wstrip__plate::before paints in the DOM. It has to
          // be part of the TEXTURE as well, or a bar would shed its glass at
          // exactly the moment it turns into the flare — which is where a pane
          // reads most like glass. Kept in step with the CSS by hand; the two
          // are a matched pair.
          //
          // The angle is honoured properly rather than eyeballed. The band used
          // to be approximated as "left to right with a slight drop", which for
          // a 1:5 pane is not what 104deg draws at all: CSS runs the gradient
          // line through the box's CENTRE along the angle and gives it length
          // |w·sin| + |h·cos|, so on a tall bar most of that length is VERTICAL
          // and the band is nearly four times longer than the approximation
          // made it. That was tolerable while the specular was 0.09 and all but
          // invisible; at the strength it needs to actually read as glass, the
          // difference lands as a step at the flare's seam.
          const cssGradient = (deg: number, stops: [number, string][]) => {
            const rad = (deg * Math.PI) / 180;
            const dx = Math.sin(rad);
            const dy = -Math.cos(rad); // CSS 0deg points UP; canvas y is down
            const len = Math.abs(pw * dx) + Math.abs(ph * dy);
            const g = ctx.createLinearGradient(
              pw / 2 - (dx * len) / 2,
              ph / 2 - (dy * len) / 2,
              pw / 2 + (dx * len) / 2,
              ph / 2 + (dy * len) / 2,
            );
            for (const [at, col] of stops) g.addColorStop(at, col);
            return g;
          };

          // 1. Lit top edge and the sheen raking off it.
          ctx.fillStyle = cssGradient(180, [
            [0, "rgba(255, 255, 255, 0.5)"],
            [0.05, "rgba(255, 255, 255, 0.16)"],
            [0.2, "rgba(255, 255, 255, 0.05)"],
            [0.44, "rgba(255, 255, 255, 0)"],
            [1, "rgba(255, 255, 255, 0)"],
          ]);
          ctx.fillRect(0, 0, pw, ph);

          // 2. The pane's body, darkening toward its foot.
          ctx.fillStyle = cssGradient(180, [
            [0, "rgba(14, 12, 18, 0)"],
            [0.52, "rgba(14, 12, 18, 0)"],
            [1, "rgba(14, 12, 18, 0.24)"],
          ]);
          ctx.fillRect(0, 0, pw, ph);

          // 3. The specular band across the pane.
          ctx.fillStyle = cssGradient(104, [
            [0, "rgba(255, 255, 255, 0)"],
            [0.26, "rgba(255, 255, 255, 0)"],
            [0.4, "rgba(255, 255, 255, 0.1)"],
            [0.47, "rgba(255, 255, 255, 0.26)"],
            [0.54, "rgba(255, 255, 255, 0.07)"],
            [0.66, "rgba(255, 255, 255, 0)"],
            [1, "rgba(255, 255, 255, 0)"],
          ]);
          ctx.fillRect(0, 0, pw, ph);

          // The pane's edges — the box-shadow insets, which are 1 CSS px
          // whatever the bake's resolution, so they are drawn in CSS px too.
          ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
          ctx.fillRect(0, 0, pw, 1);
          ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
          ctx.fillRect(0, 0, 1, ph);
          ctx.fillRect(pw - 1, 0, 1, ph);
          ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
          ctx.fillRect(0, ph - 1, pw, 1);

          const meta = plate.querySelector<HTMLElement>(".wstrip__meta");
          if (meta) {
            // Offset-based, like the plate size above: the meta's place in the
            // plate's own (untransformed) space.
            const top = meta.offsetTop;
            const g = ctx.createLinearGradient(0, ph, 0, top);
            g.addColorStop(0, "rgba(0, 0, 0, 0.55)");
            g.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = g;
            ctx.fillRect(0, top, pw, ph - top);

            for (const span of Array.from(meta.children) as HTMLElement[]) {
              if (!span.textContent || span.offsetParent === null) continue;
              const cs = getComputedStyle(span);
              ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
              (
                ctx as CanvasRenderingContext2D & { letterSpacing?: string }
              ).letterSpacing =
                cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
              ctx.fillStyle = cs.color;
              ctx.textBaseline = "alphabetic";
              const text =
                cs.textTransform === "uppercase"
                  ? span.textContent.toUpperCase()
                  : span.textContent;
              // A span's offsetTop is its border-box top — baseline minus the
              // font's ascent, the same metric the canvas reports — so this
              // puts the glyphs where the DOM put them. Spans position against
              // the META (their offsetParent, absolutely positioned), which
              // positions against the plate.
              const ascent =
                ctx.measureText(text).fontBoundingBoxAscent ??
                parseFloat(cs.fontSize) * 0.8;
              ctx.fillText(
                text,
                meta.offsetLeft + span.offsetLeft,
                meta.offsetTop + span.offsetTop + ascent,
              );
            }
          }
          return c;
        };

        // d = -1 at the left rim, +1 at the right; the shift is -d * pw * P
        // (see the drive), so the left rim pushes the picture right.
        bakesL[i] = compose(PARALLAX * pw);
        bakesR[i] = compose(-PARALLAX * pw);
      }
    };
    void bake();

    let offset = 0;
    let loopW = 1;
    let stageLeft = 0;
    let stageWCached = 1;
    /* ── The bars' untransformed layout, measured once per resize ──
       offsetLeft/Top/Width/Height describe the bar BEFORE any transform,
       and this loop only ever writes transform, clipPath and visibility —
       none of which move layout. So these four numbers cannot change
       between resizes, and reading them per bar per frame was buying the
       same answer two dozen times a frame at the price of a full re-layout
       each time: the read lands after a style write to the previous bar,
       so the browser must flush layout before it can answer.

       Measured in a production build: those gets were 97% of the whole
       plate loop, up to 9.0ms of a 16.7ms frame. Batched here they cost
       one layout, once, when the geometry actually changes. */
    const plW: number[] = [];
    const plH: number[] = [];
    const plL: number[] = [];
    const plT: number[] = [];

    const measure = () => {
      // Between the two copies' first plates, NOT scrollWidth / 2 — rects are
      // fractional, scrollWidth is rounded, and the rounding error is a
      // visible tick at the wrap.
      const first = plates[0]?.getBoundingClientRect();
      const second = plates[PROJECTS.length]?.getBoundingClientRect();
      loopW =
        first && second
          ? Math.max(1, second.left - first.left)
          : Math.max(1, track.scrollWidth / 2);
      // Cached: the whip is anchored on the pointer in STAGE space and a
      // pointermove must not pay for a layout read.
      stageLeft = stage.getBoundingClientRect().left;
      stageWCached = Math.max(1, stage.clientWidth);
      // One batch of reads with no writes in between — one layout for all
      // of them instead of one apiece.
      for (let i = 0; i < plates.length; i++) {
        const el = plates[i];
        plW[i] = el.offsetWidth;
        plH[i] = el.offsetHeight;
        plL[i] = el.offsetLeft;
        plT[i] = el.offsetTop;
      }
    };
    measure();

    // ── Tunables — the whip rail's, restored ─────────────────────────────
    // The strip took over the work section with a bare constant drift, and
    // that is what "slower" was: the rail's resting speed was this same 26,
    // but browsing it added STEER on top, so a cursor anywhere off centre had
    // the row moving at up to ~326px/sec. Losing the steer took the section
    // from a row you push around to a row that creeps.
    /** px per second, at rest. */
    const DRIFT = 26;
    /**
     * px/sec added at the very edge of the stage. Kept low on purpose: at 900
     * the row bolts away from the cursor and the work is unreadable while
     * steering. This is a browsing speed, not a ride.
     */
    const STEER_MAX = 300;
    const DEADZONE = 0.12; // fraction of half-width where steer stays 0
    const ACCEL_TAU = 0.16; // sec — how fast the row takes up a new velocity
    const FLING_TAU = 0.55; // sec — flick momentum decay
    /**
     * Cursor SPEED, not just position, throws the row: a quick flick across
     * the stage shoves it even if the cursor ends up back in the dead zone.
     * Position alone can only ever ramp smoothly to a steady speed, which is
     * the one thing a whip is not.
     */
    const FLICK_GAIN = 0.22;
    const FLICK_MAX = 900;

    // ── WHIP ──
    // Each bar trails the row by an amount proportional to the row's VELOCITY,
    // and how much it trails is staggered by its distance from the pointer:
    // the bar under the cursor keeps up, distant ones fall behind. A spring —
    // not a lerp — carries each one to that trailing position, so a sudden
    // change of direction overshoots and snaps back. That transient overshoot
    // is the whiplash; a plain velocity skew (the usual trick) only ever
    // smears, because it has no state to overshoot with.
    //
    // ── …held as a FIELD, not per bar ──
    // The rail could hang a spring off each slat because its slats wrapped
    // individually and continuously. This strip wraps differently: `offset`
    // is taken modulo one copy's width, so at the wrap EVERY bar jumps a full
    // copy sideways at once and the bar standing at a given place on screen is
    // suddenly a different element. Springs owned by the element would arrive
    // carrying a trail solved for where they used to be — up to ~25px of it at
    // steering speed, which pops. So the springs are nailed to the SCREEN
    // instead: a row of them across the stage, each solving the trail for its
    // own column, and a bar reads the field at its centre. The fan and the
    // overshoot are unchanged; the wrap simply cannot disturb them, because
    // nothing about the field moves when the bars do.
    const WHIP_COLS = 33;
    const WHIP_TAU = 0.11; // sec of trail per unit velocity
    const WHIP_STIFF = 150; // spring constant
    const WHIP_DAMP = 11; // < 2*sqrt(STIFF) => underdamped => one clean overshoot
    const LAG_MIN = 0.25; // trail multiplier at the pointer
    const LAG_MAX = 1.0; // …and a full stage-width away
    const WHIP_TILT = 0.05; // deg of extra rotateY per px of trail
    const whip = new Float32Array(WHIP_COLS);
    const whipVel = new Float32Array(WHIP_COLS);

    // ── Input ──
    let vel = DRIFT;
    let steer = 0;
    let fling = 0;
    let hovering = false;
    let pointerX = 0; // stage space; the whip's anchor
    let lastPT = 0;
    let dragging = false;
    let dragX = 0;
    let dragFrom = 0;
    let dragLastX = 0;
    let dragLastT = 0;
    let dragVel = 0;
    let moved = 0;

    const down = (e: PointerEvent) => {
      if (frozenRef.current) return;
      dragging = true;
      dragX = e.clientX;
      dragFrom = offset;
      dragLastX = e.clientX;
      dragLastT = performance.now();
      dragVel = 0;
      moved = 0;
      draggedRef.current = false;
      stage.classList.add("is-grabbing");
    };
    const move = (e: PointerEvent) => {
      moveEvents++;
      const prevX = pointerX;
      pointerX = e.clientX - stageLeft;
      if (dragging) {
        const now = performance.now();
        const dt = (now - dragLastT) / 1000;
        offset = dragFrom - (e.clientX - dragX);
        moved = Math.abs(e.clientX - dragX);
        // The drag's own velocity, in the same sign convention as `vel`
        // (offset grows as content moves left). The whip has no other way to
        // know a drag is happening — `offset` is written straight from here.
        if (dt > 0) dragVel = -(e.clientX - dragLastX) / dt;
        dragLastX = e.clientX;
        dragLastT = now;
        // Past a click's worth of travel this is a drag, and the release that
        // ends it must not open a plate.
        if (moved > 8) draggedRef.current = true;
        return;
      }
      if (!hovering || isTouchRef.current) return;
      // Steer: signed distance from the stage centre, dead in the middle so a
      // resting cursor doesn't shove the row around.
      const halfW = stageWCached / 2;
      const t = (pointerX - halfW) / halfW;
      const s =
        (Math.sign(t) * Math.max(0, Math.abs(t) - DEADZONE)) / (1 - DEADZONE);
      steer = s * STEER_MAX;

      // …and the flick impulse on top. Guarded against the huge synthetic
      // velocity a first event (or a re-entry after the pointer has been away)
      // would otherwise report.
      const now = performance.now();
      const dtp = (now - lastPT) / 1000;
      if (lastPT && dtp > 0 && dtp < 0.1) {
        fling = Math.max(
          -FLICK_MAX,
          Math.min(FLICK_MAX, fling + ((pointerX - prevX) / dtp) * FLICK_GAIN),
        );
      }
      lastPT = now;
    };
    const up = () => {
      if (dragging) {
        // Hand the drag's last velocity to the fling so a flick carries on
        // instead of stopping dead under the finger.
        fling = Math.max(-FLICK_MAX, Math.min(FLICK_MAX, dragVel - DRIFT));
      }
      dragging = false;
      dragVel = 0;
      stage.classList.remove("is-grabbing");
    };
    const enter = () => {
      hovering = true;
    };
    const leave = () => {
      hovering = false;
      steer = 0;
      pointerX = stageWCached / 2;
      lastPT = 0; // next entry starts a fresh flick sample
    };
    stage.addEventListener("pointerenter", enter);
    stage.addEventListener("pointerleave", leave);
    stage.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);

    const ro = new ResizeObserver(() => {
      measure();
      // The bakes are sized to the plate's rendered box, so they go stale the
      // moment it changes; the token in bake() collapses a burst of resize
      // callbacks into the final geometry.
      void bake();
    });
    ro.observe(stage);
    ro.observe(track);

    let running = false;
    let raf = 0;
    let last = performance.now();
    const glPlates: TunnelSlat[] = [];

    /* ── TEMPORARY work-section perf probe ─────────────────────────────
       "Laggy when the mouse moves in both directions" needs a number per
       suspect, because there are three and they are not the same fix:
       the per-frame layout the plate loop forces (it reads offsetLeft/
       Top/Width on every bar AFTER writing transform/clipPath to the one
       before, so the browser re-lays-out per bar, per frame), the flare's
       fragment bill in tunnel.render, and whatever else on the page also
       wakes on pointermove.

       Accumulates per frame, prints once a SECOND — a log per frame would
       itself be the stall it is looking for. p95 is reported next to the
       mean because lag is felt in the worst frames, not the average one.

       localhost, or ?workdebug=1. Delete once this is settled.           */
    const perfOn =
      /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?$)/.test(
        window.location.hostname,
      ) || window.location.search.includes("workdebug");
    const samples: number[] = [];
    let accWhip = 0;
    let accLoop = 0;
    let accGL = 0;
    let accCull = 0;
    let moveEvents = 0;
    let statLast = performance.now();
    let tWhip = 0;
    let tLoop = 0;
    let tGL = 0;
    // Layout READS inside the loop, timed apart from everything else. Each
    // one lands after a style write to the previous bar, so the browser has
    // to re-lay-out the document before it can answer — the suspicion is
    // that nearly all of plateLoop is these four property gets.
    let accRead = 0;

    const frame = () => {
      if (!running) {
        raf = 0;
        return;
      }
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      const frameGap = now - last;
      last = now;
      if (perfOn) tWhip = now;

      if (frozenRef.current) {
        // An image is open. Hold the row exactly where it is until the closing
        // trail has landed. Velocity is zeroed rather than merely paused so
        // the whip unwinds and the bars settle upright, instead of holding a
        // frozen skew for as long as the enlarged view is up.
        vel = 0;
        fling = 0;
      } else if (dragging) {
        // `offset` is written straight from the move handler; the whip still
        // wants a velocity, so hand it the drag's.
        vel = dragVel;
      } else {
        const vTarget = DRIFT + steer + fling;
        vel += (vTarget - vel) * (1 - Math.exp(-dt / ACCEL_TAU));
        offset += vel * dt;
        fling *= Math.exp(-dt / FLING_TAU);
        if (Math.abs(fling) < 1) fling = 0;
      }
      offset = ((offset % loopW) + loopW) % loopW;
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;

      // The whip field. Solved before the bars are placed, so every bar reads
      // the same frame of it.
      const stageW = stageWCached;
      for (let c = 0; c < WHIP_COLS; c++) {
        const colX = (c / (WHIP_COLS - 1)) * stageW;
        const lag =
          LAG_MIN +
          (LAG_MAX - LAG_MIN) *
            Math.min(Math.abs(colX - pointerX) / stageW, 1);
        const target = -lag * vel * WHIP_TAU;
        whipVel[c] += (target - whip[c]) * WHIP_STIFF * dt;
        whipVel[c] *= Math.exp(-WHIP_DAMP * dt);
        whip[c] += whipVel[c] * dt;
      }
      /** The field at a stage-space x, linearly interpolated between columns. */
      const whipAt = (x: number) => {
        const t =
          Math.max(0, Math.min(1, x / stageW)) * (WHIP_COLS - 1);
        const i0 = Math.floor(t);
        const i1 = Math.min(WHIP_COLS - 1, i0 + 1);
        return whip[i0] + (whip[i1] - whip[i0]) * (t - i0);
      };

      if (perfOn) {
        const t = performance.now();
        accWhip += t - tWhip;
        tLoop = t;
      }

      if (tunnel) {
        const stageBox = stage.getBoundingClientRect();
        // The canvas is TALLER than the stage (works-strip.css gives it ±20%
        // headroom) so the corner bars' bow can finish instead of being
        // sliced off at the stage bounds. All slat geometry below is offset
        // into the canvas's space.
        const glBox = canvas.getBoundingClientRect();
        const glOffY = stageBox.top - glBox.top;
        const vw = stageBox.width;
        // ── The lens is sized from the BAR, not the window ──
        // CLIP * vw is the reference's own lens, and it was measured against
        // pictures several times wider than itself. These bars are 9vw — the
        // whole picture sat inside the lens at once and dispersed as one red
        // smear, and on a phone (37vw bars) only a sliver of a leading edge
        // ever entered it. flareBand keys the lens to the bar so a bar always
        // keeps a flat, legible body while its leading edge turns.
        // offsetWidth, not the rect: the rect carries the plate's own
        // perspective scaling, and the lens wants the layout width.
        const barPx = plW[0] ?? 0;
        const band = flareBand(barPx, vw);
        const clipPx = band * CLIP_RATIO * vw;
        glPlates.length = 0;

        // The split — see CaseStrip: each plate is divided in SPACE, the DOM
        // keeping the clipped middle and GL drawing the warped tails.
        for (let i = 0; i < plates.length; i++) {
          const p = plates[i];
          // LAYOUT geometry, not a bounding rect. The bars now carry a whip
          // translate as part of the same transform the arc is written into,
          // so reading a BCR here would feed last frame's whip back into this
          // frame's arc — a loop that rings. offsetLeft less the track's drift
          // is stage space by construction (the track fills the stage), and
          // the projection moves x by ~1px at the rim, inside the clip's own
          // overlap.
          const rd0 = perfOn ? performance.now() : 0;
          const wUn = plW[i];
          const hUn = plH[i];
          const bare = plL[i] - offset;
          if (perfOn) accRead += performance.now() - rd0;
          // The whip is read at the bar's UNWHIPPED centre — the field is a
          // property of the screen, and sampling it at the displaced position
          // would let a bar chase its own trail.
          const wx = whipAt(bare + wUn / 2);
          const left = bare + wx;
          const right = left + wUn;

          // ── Cull ──
          // Three copies of eight bars are in the track so the wrap always has
          // spare, but on a phone only ~2.6 of the 24 are ever in frame and
          // the rest were still being composited: every bar is its own layer
          // (each carries a transform), and at 37vw x most of the stage that
          // is a lot of texture for something no one can see. Dropped from
          // paint entirely instead, and given its transform back in the same
          // frame it returns — so there is no stale pose to show.
          if (right < -40 || left > vw + 40) {
            if (!culled[i]) {
              culled[i] = 1;
              p.style.visibility = "hidden";
            }
            continue;
          }
          if (culled[i]) {
            culled[i] = 0;
            p.style.visibility = "";
          }

          // ── The curved screen ──
          // The reference's row is concave across its WHOLE width, and each
          // bar sits BALANCED on that curve: its outer vertical edge taller,
          // top and bottom edges converging symmetrically — a trapezoid, the
          // projection of a slat on the inside of a cylinder. (An earlier
          // skewY pass slanted both edges the same way instead, which reads
          // as the bar being rotated about the z-axis — and, being asymmetric
          // where the GL curve is symmetric, it also showed at the seam.)
          //
          // So each plate carries a true cylinder projection: perspective +
          // rotateY, the rotation solved so the vertical-edge height ratio
          // matches the arc's slope at this bar (a = q·P below), scaleY for
          // the bar's own height on the arc, scaleX undoing the rotation's
          // foreshortening so the gutters keep their width. The tunnel shader
          // draws the same parabola exactly (uArcBow); trapezoid chords agree
          // with it to under a pixel across one slat, which is what keeps the
          // handoff blend invisible.
          //
          // The GL copies are handed UNTRANSFORMED geometry (offsetTop/
          // offsetHeight — x stays put: the residual horizontal warp of the
          // projection is ~1px at the rim, inside the clip's 2px overlap) and
          // the shader bows them itself.
          const dxc = Math.max(
            -1,
            Math.min(1, ((left + right) / 2 / vw - 0.5) * 2),
          );
          const s0 = 1 + STRIP_BOW * dxc * dxc; // arc height at this bar
          // Arc slope per px of screen x → required edge-to-edge scale ratio.
          const q = (4 * STRIP_BOW * dxc) / vw / s0;
          const PERSP = 600;
          // The whip's tilt is folded into the SAME theta the arc solves,
          // rather than added as a second rotation: `skew` below is handed to
          // the shader and the clip solver inverts it, so a tilt they could
          // not see would put all three out of step at the seam.
          const theta =
            -Math.asin(Math.max(-0.6, Math.min(0.6, q * PERSP))) +
            (wx * WHIP_TILT * Math.PI) / 180;
          // The transform's two terms, as the shader wants them. tan, not sin:
          // scaleX(1/cos) is applied FIRST, so the rotation leaves the point at
          // z = -x*tan(theta) and the perspective divisor is 1 + x*tan/d.
          const skew = Math.tan(theta) / PERSP;
          // The whip translate leads, so it lands in the PARENT's space — a
          // flat screen-space shift of the finished projection, which is
          // exactly what the GL copy gets by having `wx` folded into its rect.
          const tf =
            `translate3d(${wx.toFixed(2)}px, 0, 0) ` +
            `scaleY(${s0.toFixed(4)}) perspective(${PERSP}px) ` +
            `rotateY(${((theta * 180) / Math.PI).toFixed(3)}deg) ` +
            `scaleX(${(1 / Math.cos(theta)).toFixed(4)})`;
          if (p.style.transform !== tf) p.style.transform = tf;

          // ── The moving-image illusion ──
          // The picture drifts against its bar as the bar crosses the window,
          // so the bar reads as a window onto something behind the page rather
          // than a printed card sliding past. Overscanned in the stylesheet by
          // exactly enough that this swing never pulls an edge into view.
          //
          // ── …and PINNED before the flare takes over ──
          // The bake can only hold one framing of the photo per side, so the
          // drift has to have finished by the time any of the bar belongs to
          // GL — otherwise the DOM half and the GL half show the picture at
          // different offsets and the handoff is a step in the middle of the
          // image. `dTail` is where the tail starts: the bar's centre when its
          // trailing edge first reaches the clip line, in the same -1…1 units
          // as dxc. It is not a constant — it depends on how much of the window
          // one bar covers, and that is exactly what changes between a desktop
          // (bars ~9vw, so the drift has 80% of the screen to play out in) and
          // a phone (bars 37vw, where the flare claims the bar much sooner).
          // Trimmed by a tenth so the pin is comfortably in place before the
          // first GL pixel appears, and smoothstepped so it eases into the
          // hold rather than arriving at it.
          const shiftEl = shifts[i];
          if (shiftEl) {
            const dTail = Math.max(0.06, 1 - (2 * clipPx + wUn) / vw) * 0.9;
            const u = Math.min(1, Math.abs(dxc) / dTail);
            const eased = u * u * (3 - 2 * u);
            const px = -Math.sign(dxc) * eased * wUn * PARALLAX;
            const sTf = `translate3d(${px.toFixed(2)}px, 0, 0)`;
            if (shiftEl.style.transform !== sTf) shiftEl.style.transform = sTf;
          }

          // How far the DOM keeps drawing PAST the clip line, px.
          //
          // It has to cover the projection error. clip-path is applied in the
          // plate's own border-box space and only THEN transformed by the
          // cylinder projection, while `inL`/`inR` are measured from the
          // post-transform bounding rect — so the clipped edge does not land
          // exactly where the maths put it, and the gap between where the DOM
          // stops and where the GL tail starts shows the dark section through
          // as a hairline. The error grows with the rotation, which is largest
          // at the rim, which is precisely where the seam lives.
          //
          // 6, not 2: with the clip now solved against the shader's real mask,
          // the two copies are identical in colour AND geometry at the seam
          // (the warp is worth ~0.0002px there and `fx` holds the tint at 0),
          // so overlapping them by more costs nothing visible. It only used to
          // be kept tight because the old seam position had them disagreeing.
          // ── Where to cut the DOM copy ──
          // clip-path is applied in the plate's OWN box, BEFORE the projection
          // above. Measuring the inset off the transformed bounding rect — as
          // this did — therefore puts the cut somewhere else entirely once the
          // projection has had its say, and the error is largest at the rim,
          // which is exactly where the seam lives. What was left over showed
          // the dark section through as a hairline down every edge bar.
          //
          // So convert the target screen position back into the plate's own
          // space first, by inverting the shader's map.
          const cxUn = left + wUn / 2;
          const toLocal = (stageX: number) => {
            const px = stageX - cxUn;
            return px / (1 - px * skew);
          };
          const OVERLAP = 6;
          const inL = Math.max(
            0,
            Math.min(wUn, toLocal(clipPx) + wUn / 2 - OVERLAP),
          );
          const inR = Math.max(
            0,
            Math.min(wUn, wUn / 2 - toLocal(vw - clipPx) - OVERLAP),
          );
          const clip =
            inL > 0.5 || inR > 0.5
              ? `inset(0 ${inR.toFixed(2)}px 0 ${inL.toFixed(2)}px)`
              : "";
          if (p.style.clipPath !== clip) p.style.clipPath = clip;

          const img = imgs[i];
          if (!img) continue;
          if (right <= 0 || left >= vw) continue;
          if (inL <= 0.5 && inR <= 0.5) continue;
          glPlates.push({
            // Untransformed layout geometry on BOTH axes now. The track fills
            // the stage and is translated by -offset, so offsetLeft/offsetTop
            // less that drift is stage-space; glOffY carries y into the
            // extended canvas. x and w used to come from the TRANSFORMED
            // bounding rect while the shader drew a flat quad inside it —
            // which is why the GL copy sat a few pixels off its DOM twin and
            // ghosted at the seam. The shader now applies the same
            // perspective map, so it needs the same input the DOM had.
            x: left,
            y: plT[i] + glOffY,
            w: wUn,
            h: hUn,
            // sin(theta)/d — the exact horizontal term of the plate's own
            // `perspective(PERSP) rotateY(theta) scaleX(1/cos theta)`.
            skew,
            scaleY: s0,
            // The composed plate — picture, scrim and caption as one surface —
            // so the caption travels through the flare with the image. Falls
            // back to the bare image until the bake lands. Which of the two
            // bakes is decided by the rim the bar is leaving through: that is
            // where its parallax is pinned, and the bake was composed at
            // exactly that framing.
            img:
              (dxc < 0
                ? bakesL[i % PROJECTS.length]
                : bakesR[i % PROJECTS.length]) ?? img,
          });
        }
        if (perfOn) {
          const t = performance.now();
          accLoop += t - tLoop;
          accCull += glPlates.length;
          tGL = t;
        }
        tunnel.render(
          glPlates,
          vw,
          glBox.height,
          // The fan's centreline is the STAGE's middle, expressed in the
          // canvas's space — with symmetric headroom the two coincide, but
          // derive it rather than assume.
          glOffY + stageBox.height / 2,
          stageBox.height / 2,
          // ── The flare's own resolution, capped harder on a phone ──
          // This canvas is the section's biggest per-frame bill: it spans the
          // full window and 140% of the stage, so on a 390x844 phone at dpr 2
          // that is 1.5M fragments, every one of them running the dispersion
          // shader, every frame the section is on screen. What it draws there
          // is a soft, heavily-warped red dispersion — the one thing on the
          // page with no fine detail to lose — so dropping it to 1.5 costs
          // nothing visible and takes 44% of the fill with it. Desktop keeps
          // 2: the tail there carries a legible slice of photograph and its
          // caption right up to the seam.
          Math.min(
            window.devicePixelRatio || 1,
            window.innerWidth <= 767 ? 1.5 : 2,
          ),
          1,
          1,
          // 0, not STRIP_BOW: the arc now reaches the GL copies through each
          // plate's own scaleY, which is the DOM's version of the same curve.
          // Letting the shader add its per-vertex arc on top would bow the
          // copies twice and put them back out of step with their DOM halves.
          0,
          band,
        );
      }
      if (perfOn) {
        if (tGL) accGL += performance.now() - tGL;
        tGL = 0;
        samples.push(frameGap);
        if (now - statLast >= 1000) {
          const n = samples.length || 1;
          const sorted = [...samples].sort((x, y) => x - y);
          const p95 = sorted[Math.min(n - 1, Math.floor(n * 0.95))];
          const mean = samples.reduce((x, y) => x + y, 0) / n;
          // A frame is only LATE if the display had to repeat it. At 60Hz
          // every healthy frame measures ~16.7ms, so counting >16.7 flags
          // vsync itself and reports 30 drops out of 60 on a page that
          // never stuttered. 25ms is a missed vsync with jitter to spare.
          const late = samples.filter((v) => v > 25).length;
          const worst = sorted[n - 1];
          console.log(
            `[WORK] ${n} fps · frame mean ${mean.toFixed(1)}ms p95 ${p95.toFixed(1)}ms worst ${worst.toFixed(1)}ms · late ${late}/${n}` +
              ` · whip ${(accWhip / n).toFixed(2)}ms · plateLoop ${(accLoop / n).toFixed(2)}ms` +
              ` · flare ${(accGL / n).toFixed(2)}ms · OF WHICH layoutReads ${(accRead / n).toFixed(2)}ms · slats ${(accCull / n).toFixed(1)}` +
              ` · pointermove ${moveEvents}/s`,
          );
          samples.length = 0;
          accWhip = accLoop = accGL = accCull = moveEvents = accRead = 0;
          statLast = now;
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
        if (running && !raf) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      },
      { threshold: 0 },
    );
    io.observe(stage);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointerenter", enter);
      stage.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      tunnel?.dispose();
      tunnelRef.current = null;
    };
  }, []);

  return (
    <section className="wstrip cstrip" id="work" aria-label="Selected work">
      {/* The rail's head, restyled for the white sheet. */}
      <header className="wstrip__head">
        <span className="wstrip__eyebrow">Selected Work</span>
        <span className="wstrip__count">({PROJECTS.length})</span>
      </header>

      <div className="cstrip__stage" ref={stageRef}>
        <div className="cstrip__track" ref={trackRef}>
          {/* Rendered THREE times, wrapping at one set's width. The case strip
              gets away with two copies because its plates are wide — one set
              alone outspans the window. At slat widths a set of eight is only
              ~87vw, so with two copies the moment before the wrap needs more
              track than exists and a gap slides through; the third copy covers
              offset + a full window at any size. The open handler indexes into
              the single list, so every copy of a plate leads to the same
              work. */}
          {PROJECTS.concat(PROJECTS, PROJECTS).map((p, i) => (
            <figure
              className="cstrip__plate wstrip__plate"
              data-plate
              key={`${p.name}-${i}`}
              onPointerUp={open(i % PROJECTS.length)}
              onPointerEnter={hoverCaption(true)}
              onPointerLeave={hoverCaption(false)}
            >
              {/* The picture's own box, wider than the bar, so it can drift
                  against it without ever showing an edge — see PARALLAX. The
                  caption, the glass and the vignette are siblings of this and
                  stay pinned to the bar. */}
              <div className="wstrip__shift">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.src}
                  alt={p.name}
                  draggable={false}
                  // The enlarged view reuses this already-decoded image, and
                  // the splash there uploads it into a WebGL texture —
                  // cross-origin without this would taint the upload.
                  crossOrigin="anonymous"
                  loading="eager"
                  decoding="async"
                />
              </div>
              {/* Number + name + service over the foot of the plate — each
                  image labelled with the work it opens. */}
              <figcaption className="wstrip__meta">
                <span className="wstrip__meta-no">
                  {String((i % PROJECTS.length) + 1).padStart(2, "0")}
                </span>
                <span className="wstrip__meta-name">{p.name}</span>
                <span className="wstrip__meta-service">{p.service}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <canvas ref={glRef} className="cstrip__gl" aria-hidden />
      </div>

      {/* The enlarged view — the rail's lightbox, reused wholesale. Portaled
          to <body> so `fixed` resolves against the viewport. */}
      {selected !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={lightboxRef}
            className="wrail__lightbox bg-black/30 backdrop-blur-2xl"
            data-lenis-prevent
            role="dialog"
            aria-modal="true"
            aria-label={PROJECTS[selected].name}
            onClick={closeLightbox}
          >
            <button
              type="button"
              className="wrail__lightbox-close liquid-glass"
              aria-label="Close"
              onClick={closeLightbox}
            >
              <ChromaticMetal />✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={lightboxImgRef}
              src={PROJECTS[selected].src}
              alt={PROJECTS[selected].name}
              className="wrail__lightbox-img"
              crossOrigin="anonymous"
              style={
                prefersReducedMotion
                  ? undefined
                  : { clipPath: TRAIL_HIDDEN_CLIP }
              }
            />
            <div ref={lightboxCapRef} className="wrail__lightbox-cap">
              <span className="wrail__lightbox-year">
                {PROJECTS[selected].year}
              </span>
              <h3 className="wrail__lightbox-name">
                {PROJECTS[selected].name}
              </h3>
              <span className="wrail__foot-service">
                {PROJECTS[selected].service}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
