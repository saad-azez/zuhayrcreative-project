"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import {
  createRailTunnel,
  handoffAt,
  type TunnelSlat,
} from "./railTunnel";
import { useSplashHover } from "./useSplashHover";
import { useImageTrail, TRAIL_HIDDEN_CLIP } from "@/app/animations/useImageTrail";
import "@/app/styles/works-rail.css";

/**
 * ⚠️ PLACEHOLDER projects — swap `src`, `name`, `service`, `year` for the real
 * work. Note the 600×900 PORTRAIT crops: this layout stands the work up in tall
 * slats, and a square source either letterboxes or crops to nothing. Whatever
 * replaces these needs to be shot/cropped 2:3 or taller.
 */
interface Project {
  src: string;
  name: string;
  service: string;
  year: string;
}

/**
 * Plates are the local /club artwork rather than the picsum placeholders they
 * were. Two reasons beyond it being the real imagery: picsum is a remote host,
 * so every plate cost a round trip and could fail independently; and these are
 * same-origin, which matters because the slats are uploaded as WebGL textures —
 * a cross-origin image without CORS taints the upload and the tile silently
 * fails to draw.
 *
 * Ten slides across fourteen projects, so the list cycles. The repeats sit far
 * enough apart on the rail not to land in view together.
 */
const PROJECTS: Project[] = [
  { src: "/club/slide-1.jpg", name: "Forma Digital", service: "Brand Identity", year: "2026" },
  { src: "/club/slide-2.jpg", name: "Nero Vision", service: "Motion Design", year: "2025" },
  { src: "/club/slide-3.jpg", name: "Lumina Arc", service: "Web Experience", year: "2025" },
  { src: "/club/slide-4.jpg", name: "Atlas Foundry", service: "Brand Systems", year: "2024" },
  { src: "/club/slide-5.jpg", name: "Halo Studio", service: "Creative Direction", year: "2024" },
  { src: "/club/slide-6.jpg", name: "Drift Labs", service: "AI Automation", year: "2026" },
  { src: "/club/slide-7.jpg", name: "Solace", service: "Web Design", year: "2025" },
  { src: "/club/slide-8.jpg", name: "Vanta Goods", service: "Brand Identity", year: "2023" },
  { src: "/club/slide-9.jpg", name: "Pulse Health", service: "Product Design", year: "2024" },
  { src: "/club/slide-10.jpg", name: "Orbit Media", service: "Search Growth", year: "2025" },
  { src: "/club/slide-1.jpg", name: "Kestrel", service: "Art Direction", year: "2023" },
  { src: "/club/slide-2.jpg", name: "Mono Atelier", service: "Web Design", year: "2026" },
  { src: "/club/slide-3.jpg", name: "Spectra", service: "Motion Design", year: "2024" },
  { src: "/club/slide-4.jpg", name: "Northbound", service: "Brand Systems", year: "2025" },
];

/**
 * One slat.
 *
 * Deliberately NOT wired to `useSplashHover`, unlike the ferris wheel items it
 * replaces. The hook lazily creates a WebGL context per hovered element, and a
 * single sweep of the cursor along this rail hovers most of the row — measured
 * at 8 live contexts, on top of the ones the Unicorn background, the services
 * tunnel and the globe already hold. Past the browser's context ceiling the
 * oldest are killed and the page starts throwing. The effect earned little
 * here anyway: a ripple that chases the cursor across a slat reads poorly when
 * the slat is itself drifting out from under it. It stays on the enlarged
 * image, which is large, static, and only ever one at a time.
 *
 * `crossOrigin` is kept — the enlarged view reuses this exact already-decoded
 * image, and the splash there uploads it into a texture that a cross-origin
 * image without it would taint.
 */
function Slat({
  project,
  index,
  eager,
  registerRef,
  registerImgRef,
  onSelect,
}: {
  project: Project;
  index: number;
  eager: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
  registerImgRef: (el: HTMLDivElement | null) => void;
  onSelect: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      ref={registerRef}
      className="wrail__slat"
      onPointerUp={onSelect}
      // data-i is read by the rAF loop's hover delegation on the stage — see
      // the HOVER_GROW block there. Threading a React callback per slat would
      // re-render the whole rail on every pointer crossing instead.
      data-i={index}
      style={{ ["--i" as string]: index }}
    >
      {/* The frame clips; the picture inside is oversized and counter-shifts as
          the slat crosses the screen. That inner parallax is what turns "cards
          sliding past" into "moving past objects" — it is the cheapest depth
          cue available and does most of the work here. */}
      <div className="wrail__frame">
        <div className="wrail__shift" ref={registerImgRef}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.src}
            alt={project.name}
            className="wrail__img"
            draggable={false}
            crossOrigin="anonymous"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
          />
        </div>
        {/* Composited dimmer for the depth falloff. A per-frame `filter:
            brightness()` would repaint each slat every frame; animating the
            opacity of a flat overlay stays on the compositor. */}
        <span className="wrail__shade" aria-hidden />
      </div>
      {/* Number + name, over the foot of the picture, revealed on hover.
          Deliberately a SIBLING of the frame rather than a child of it: the
          hover grow is a scaleY on the frame, and anything inside would be
          stretched with it — the type would visibly distort. Out here it keeps
          its own metrics and simply sits over the image. */}
      <div className="wrail__meta">
        <span className="wrail__meta-rule" aria-hidden />
        <span className="wrail__meta-no">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="wrail__meta-name">{project.name}</span>
      </div>
    </div>
  );
}

/**
 * Selected work — the "whip rail".
 *
 * Replaces the orbiting ferris wheel, which failed for a reason that was
 * geometric rather than tunable: a circle needs two generous dimensions and a
 * portrait phone only has one. Its radius was `min(h*0.4, w*0.28)`, so width
 * always won and the whole wheel collapsed to a ~109px radius ring of 74px
 * thumbnails on a phone — the hero image of the work section was 148px across.
 * Depth was faked with scale and z-index alone, with no z-axis at all.
 *
 * Tall slats spend HEIGHT, which is the axis a phone has to spare, and the
 * depth here is real: slats sit in a perspective volume, angle toward the
 * vanishing point, recede on Z, dim with distance, and each picture parallaxes
 * inside its own frame.
 *
 * Motion is three layers stacked:
 *   1. a constant drift, so the rail is alive at rest;
 *   2. steer — cursor X (or a finger drag) adds velocity on top;
 *   3. the whip — see WHIP below.
 */
/**
 * @param flare  Draw the edge flare — a GL copy of each slat that reproduces
 *               this rail's own 3D arc and then bows it toward the window
 *               edges. Off by default, so the section is unchanged until it is
 *               switched on deliberately.
 * @param anchor Whether this instance owns the #work anchor. A second instance
 *               mounted for comparison must not duplicate the id.
 */
export default function WorksRail({
  flare = false,
  anchor = true,
}: {
  flare?: boolean;
  anchor?: boolean;
} = {}) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const slatRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shiftRefs = useRef<(HTMLDivElement | null)[]>([]);
  const draggedRef = useRef(false); // set during a drag so it doesn't open one
  const lightboxImgRef = useRef<HTMLImageElement>(null);
  const lightboxCapRef = useRef<HTMLDivElement>(null);
  const trail = useImageTrail();
  // Read by the rail engine each frame — see the freeze block in `frame`.
  const frozenRef = useRef(false);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const { isTouch, prefersReducedMotion } = useDeviceDetect();

  const [focusIndex, setFocusIndex] = useState(0);
  const focusRef = useRef(0);
  const [entered, setEntered] = useState(false);
  // Set once the staggered entrance has played out, which drops the opacity
  // transition so the per-frame corner fade below is immediate rather than
  // trailing 0.7s behind the rail. See .wrail__stage.is-live.
  const [live, setLive] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  useSplashHover(lightboxRef, selected !== null);

  // Staggered entrance — trigger once when the section scrolls into view.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setEntered(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The last slat's fade ends at 0.7s + its 45ms-per-slat delay.
  useEffect(() => {
    if (!entered) return;
    const t = window.setTimeout(
      () => setLive(true),
      700 + PROJECTS.length * 45 + 100,
    );
    return () => window.clearTimeout(t);
  }, [entered]);

  // ── Enlarged view ────────────────────────────────────────────────────

  useEffect(() => {
    if (selected === null) return;
    document.body.style.overflow = "hidden";
    window.dispatchEvent(new Event("app:scroll-lock"));
    return () => {
      document.body.style.overflow = "";
      window.dispatchEvent(new Event("app:scroll-unlock"));
    };
  }, [selected]);

  // Entrance: the repeating image trail runs from the slat that was clicked out
  // to this image, and the image wipes on as the leading clone lands.
  //
  // This replaces the old FLIP (which scaled the picture up from the rail).
  // Both animate the same journey; only one of them can own it, and the trail
  // is now the site-wide entrance for every click-to-open image.
  //
  // The image's own opacity is still handled here and NOT by the trail: the
  // stylesheet parks it at 0 so there is no one-frame flash at the final
  // position, and from here on opacity belongs to the hover splash, which
  // hides the image to hand the picture to its ripple canvas. The trail only
  // ever animates `clip-path`, so the two never fight — and clip-path costs
  // nothing in layout, which is what keeps the image exactly where it was.
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

  // Exit: trail back out to the slat, then unmount once the image has wiped
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
      // Resume only once the LAST clone has landed on the slat.
      () => {
        frozenRef.current = false;
      },
    );
  }, [selected, prefersReducedMotion, trail]);

  // Escape closes through the same exit animation as a click, rather than
  // yanking the image off screen. Declared after closeLightbox so the effect
  // can depend on it.
  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, closeLightbox]);

  // ── The rail engine ──────────────────────────────────────────────────
  useEffect(() => {
    if (prefersReducedMotion) return; // static row, see CSS
    const stage = stageRef.current;
    const slats = slatRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!stage || !slats.length) return;
    const N = slats.length;

    // ── Tunables ──
    const DRIFT = 26; // px/sec — the rail is never fully still
    // px/sec added at the very edge of the stage. Kept low on purpose: at 900
    // the rail bolted away from the cursor and the work was unreadable while
    // steering. This is a browsing speed, not a ride.
    const STEER_MAX = 300;
    const DEADZONE = 0.12; // fraction of half-width where steer stays 0
    const ACCEL_TAU = 0.16; // sec — how fast the rail takes up a new velocity
    const FLING_TAU = 0.55; // sec — flick momentum decay
    // ── The curve ──
    // The rail is laid on the inside of a cylinder, so the row reads as one
    // curved screen rather than a row of cards. Two values define it and they
    // must be used together: every slat is turned by its own angle on the arc
    // and pushed back by the DEPTH THAT ANGLE IMPLIES.
    //
    // The z profile is what makes or breaks it. Pushing back in proportion to
    // the distance from the centre — z = -|d| * depth, which is what this used
    // to do — is a straight line, so the row creased into a shallow V with a
    // visible kink in the middle. R·(1 − cos θ) is the actual sagitta of the
    // arc: flat through the centre, falling away increasingly toward the edges.
    const ARC = 46; // deg the outermost slat is turned by
    const CURVE_R = 1250; // px cylinder radius → ~380px of depth at the edge
    // Which way the row bends.
    //   -1 CONCAVE — the viewer stands at the centre of curvature and the row
    //      wraps around them: the outer pillars lean IN and come FORWARD, the
    //      centre sits furthest back. A curved screen, in the cinema sense.
    //   +1 CONVEX — the centre bulges toward the viewer and the outer pillars
    //      fall away behind it, like the outside of a barrel.
    // Both are "curved"; they are mirror images, and it is the one thing about
    // this layout you cannot tell from a still frame — which is how the first
    // pass ended up on the wrong one.
    const CURVE_DIR = -1;
    // Deliberately small. The reference is a curved WALL of pictures, and the
    // perspective already foreshortens the outer slats plenty; scaling them down
    // on top of that read as a row of differently-sized cards instead.
    const SHRINK = 0.05; // scale lost at the edges, on top of the perspective
    // Inner counter-parallax, as a fraction of slat width. Was 0.09, which is
    // a 26px swing on a 146px slat — real, but below the threshold anyone
    // notices. MUST stay under the overscan slack in .wrail__shift (currently
    // 20% either side) or the picture pulls off its frame and exposes an edge.
    const PARALLAX = 0.17;
    // Off. Dimming the outer slats to 0.55 was most of the "dark vignette"
    // across the section — eleven slats each fading to near-black at the edges
    // reads as a darkened frame around the whole rail, not as depth. The curve
    // and the foreshortening carry the depth on their own.
    const DIM = 0;

    // Corner fade — see edgeFade in measure(), which sizes the band.

    // How much a slat grows while hovered. A UNIFORM scale, not a scaleY: height
    // alone was too subtle to pick the hovered picture out of eleven neighbours,
    // and growing on both axes lets it overlap them slightly, which is what
    // actually reads as "this one". On the FRAME only (never the slat) so the
    // caption over the picture keeps its own metrics — see .wrail__meta.
    const HOVER_GROW = 0.075;
    const HOVER_TAU = 0.14; // sec — eased, so it grows rather than snapping

    // WHIP. Each slat trails the rail by an amount proportional to the rail's
    // VELOCITY, and how much it trails is staggered by its distance from the
    // pointer: the slat under the cursor keeps up, distant ones fall behind. A
    // spring — not a lerp — carries each one to that trailing position, so a
    // sudden change of direction overshoots and snaps back. That transient
    // overshoot is the whiplash; a plain velocity skew (the usual trick) only
    // ever smears, because it has no state to overshoot with.
    //
    // Keying the trail on velocity rather than on acceleration is what keeps
    // this stable: at a constant drift the steady-state trail is DRIFT * TAU ≈
    // 2px, so the row sits evenly spaced at rest and only fans while something
    // is actually moving it.
    const WHIP_TAU = 0.11; // sec of trail per unit velocity
    const WHIP_STIFF = 150; // spring constant
    const WHIP_DAMP = 11; // < 2*sqrt(STIFF) ⇒ underdamped ⇒ one clean overshoot
    const LAG_MIN = 0.25; // trail multiplier at the pointer
    const LAG_MAX = 1.0; // …and a full stage-width away
    const WHIP_TILT = 0.05; // deg of extra rotateY per px of trail
    // Cursor SPEED, not just position, throws the rail: a quick flick across
    // the stage shoves it even if the cursor ends up back in the dead zone.
    // Position alone can only ever ramp smoothly to a steady speed, which is
    // the one thing a whip is not.
    // Scaled back with STEER_MAX — a flick used to add up to 2600px/sec on top
    // of the steer, which is most of why moving the cursor felt like a launch.
    const FLICK_GAIN = 0.22;
    const FLICK_MAX = 900;
    // Above this rail speed the centre slat is changing too fast to label.
    const FOCUS_SETTLE_VEL = 420; // px/sec

    let w = 0;
    let slot = 0;
    let slatW = 0;
    let total = 0;
    // Width of the fade band at each edge of the stage, over which a slat ramps
    // up to full opacity — without it a slat snapped into existence the instant
    // it wrapped past the edge, which read as pictures popping out of nowhere.
    // A FRACTION of the stage, not a fixed 260px: on a phone that fixed band
    // covered most of the screen, so even the centre slat never got past 0.84
    // opacity and the whole rail looked washed out.
    let edgeFade = 0;
    let slatTop = 0;
    let slatH = 0;
    const glSlats: TunnelSlat[] = [];
    const slatImgs = slats.map((s) => s.querySelector("img"));
    const tunnel =
      flare && glRef.current ? createRailTunnel(glRef.current) : null;
    // Cached so the pointer handler never reads layout. Only a horizontal
    // layout change can move this — the page never scrolls sideways, and
    // vertical scroll doesn't alter a rect's `left`.
    let stageLeft = 0;
    // Resolved once instead of walking the DOM whenever a shade value changes.
    const shades: (HTMLElement | null)[] = [];
    const frames: (HTMLElement | null)[] = [];

    const measure = () => {
      const r = stage.getBoundingClientRect();
      w = r.width;
      stageLeft = r.left;
      // Fractional counts on purpose: the edge slats are always cut, which is
      // what reads as "this continues" rather than "this is all of it".
      //
      // Counts are high — the reference packs ten or so narrow slats across the
      // screen, and that density is most of why it reads as one curved surface
      // rather than a handful of cards on an arc. Phones keep a low count: the
      // same density there would leave each picture too narrow to make out.
      const inView = w >= 1200 ? 9.5 : w >= 981 ? 7.5 : w >= 601 ? 4.5 : 2.1;
      slot = w / inView;
      // Near-flush: just a hairline of background between neighbours, so the row
      // reads as a continuous wall.
      slatW = slot * 0.965;
      edgeFade = Math.min(260, w * 0.18);
      total = N * slot;
      // The GL copies need the slat's untransformed box; every slat shares
      // it, so it is read once here rather than per frame.
      slatTop = slats[0]?.offsetTop ?? 0;
      slatH = slats[0]?.offsetHeight ?? 0;
      for (let i = 0; i < N; i++) {
        slats[i].style.width = `${slatW}px`;
        shades[i] = slats[i].querySelector(".wrail__shade");
        frames[i] = slats[i].querySelector(".wrail__frame");
      }
    };
    measure();

    // ── State ──
    let railOffset = 0;
    let railVel = 0;
    const whip = new Float32Array(N);
    const whipVel = new Float32Array(N);
    const shadeCache = new Float32Array(N).fill(-1);
    const hiddenCache = new Uint8Array(N);
    const edgeCache = new Float32Array(N).fill(-1);
    // Per-slat hover amount, 0…1, eased toward its target every frame.
    const hoverAmt = new Float32Array(N);
    const hoverCache = new Float32Array(N).fill(-1);
    let hoverIndex = -1;

    // ── Input ──
    let pointerX = w / 2; // where the whip is anchored
    let steer = 0;
    let hovering = false;
    let dragging = false;
    let dragLastX = 0;
    let dragLastT = 0;
    let dragVel = 0;
    let fling = 0;
    let moved = 0;

    let lastPT = 0;

    const onPointerMove = (e: PointerEvent) => {
      const prevX = pointerX;
      pointerX = e.clientX - stageLeft;
      if (dragging) {
        const now = performance.now();
        const dx = e.clientX - dragLastX;
        const dt = (now - dragLastT) / 1000;
        moved += Math.abs(dx);
        railOffset -= dx;
        if (dt > 0) dragVel = -dx / dt;
        dragLastX = e.clientX;
        dragLastT = now;
        if (moved > 8) draggedRef.current = true;
        return;
      }
      if (!hovering || isTouch) return;
      // Steer: signed distance from the stage centre, dead in the middle so a
      // resting cursor doesn't shove the rail around.
      const t = (pointerX / w) * 2 - 1;
      const s = Math.sign(t) * Math.max(0, Math.abs(t) - DEADZONE) /
        (1 - DEADZONE);
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

    const onEnter = () => {
      hovering = true;
    };
    const onLeave = () => {
      hovering = false;
      steer = 0;
      pointerX = w / 2;
      lastPT = 0; // next entry starts a fresh flick sample
      hoverIndex = -1;
    };

    // Which slat the cursor is over, by delegation on the stage. pointerover /
    // pointerout bubble (pointerenter / pointerleave do not), so one pair of
    // listeners covers all fourteen and no slat needs its own handler — which
    // would mean a React re-render of the rail on every crossing.
    const onOver = (e: PointerEvent) => {
      const slat = (e.target as HTMLElement | null)?.closest?.(".wrail__slat");
      const i = slat ? Number((slat as HTMLElement).dataset.i) : NaN;
      hoverIndex = Number.isInteger(i) ? i : -1;
    };
    const onOut = (e: PointerEvent) => {
      // Ignore the pointerout that fires when moving BETWEEN two elements of
      // the same slat (frame → image), which would otherwise flicker the grow.
      const to = (e.relatedTarget as HTMLElement | null)?.closest?.(
        ".wrail__slat",
      );
      if (!to) hoverIndex = -1;
    };

    const onDown = (e: PointerEvent) => {
      dragging = true;
      draggedRef.current = false;
      moved = 0;
      dragVel = 0;
      fling = 0;
      dragLastX = e.clientX;
      dragLastT = performance.now();
      stage.classList.add("is-grabbing");
    };
    const endDrag = (fl: boolean) => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove("is-grabbing");
      // A touch gesture does NOT always end in `pointerup` — the browser fires
      // `pointercancel` the moment it claims the drag for a page scroll. The
      // old wheel only listened for pointerup, so `dragging` stayed true and
      // its guard froze the rotation until the next touch. Both are handled,
      // and a cancelled gesture deliberately does not fling.
      fling = fl ? Math.max(-4000, Math.min(4000, dragVel)) : 0;
      dragVel = 0;
    };
    const onUp = () => endDrag(true);
    const onCancel = () => endDrag(false);

    stage.addEventListener("pointerenter", onEnter);
    stage.addEventListener("pointerleave", onLeave);
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointerover", onOver);
    stage.addEventListener("pointerout", onOut);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);

    let lastW = window.innerWidth;
    const onResize = () => {
      // Height-only resizes are the mobile URL bar sliding; re-measuring on
      // those would restate every slat's width for nothing.
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      measure();
    };
    window.addEventListener("resize", onResize);

    const mod = (v: number, m: number) => ((v % m) + m) % m;

    let raf = 0;
    let running = true;
    let last = performance.now();

    const frame = (now: number) => {
      if (!running) {
        raf = 0;
        return;
      }
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;

      if (frozenRef.current) {
        // An image is open. Hold the rail exactly where it is until the closing
        // trail has landed: the clones fly to the slat that was clicked, and a
        // rail still drifting under them is a target that has moved on — 26px a
        // second adds up to a long way while someone reads a caption.
        //
        // Velocity is zeroed rather than merely paused so the whip unwinds and
        // the slats settle upright, instead of holding a frozen skew.
        railVel = 0;
        fling = 0;
      } else if (dragging) {
        // railOffset is written straight from the move handler; the whip still
        // wants a velocity, so hand it the drag's.
        railVel = dragVel;
      } else {
        const vTarget = DRIFT + steer + fling;
        railVel += (vTarget - railVel) * (1 - Math.exp(-dt / ACCEL_TAU));
        railOffset += railVel * dt;
        fling *= Math.exp(-dt / FLING_TAU);
        if (Math.abs(fling) < 1) fling = 0;
      }

      let bestD = Infinity;
      let bestI = 0;

      glSlats.length = 0;
      for (let i = 0; i < N; i++) {
        // Wrap into [-slot, total-slot): a slat leaving the left edge reappears
        // off the right, which is off-screen so long as total > w + slot.
        const x = mod(i * slot - railOffset + slot, total) - slot;
        const cx = x + slatW / 2;

        // Whip — integrated for every slat, on-screen or not, so one that wraps
        // back in arrives already settled instead of snapping into place.
        const lag =
          LAG_MIN +
          (LAG_MAX - LAG_MIN) * Math.min(Math.abs(cx - pointerX) / w, 1);
        const wTarget = -lag * railVel * WHIP_TAU;
        whipVel[i] += (wTarget - whip[i]) * WHIP_STIFF * dt;
        whipVel[i] *= Math.exp(-WHIP_DAMP * dt);
        whip[i] += whipVel[i] * dt;

        const el = slats[i];
        const finalX = x + whip[i];

        // Cull: an off-screen slat is dropped from compositing entirely rather
        // than kept as a live layer. On a phone only ~2 of the 14 are ever in
        // view, and every promoted slat costs slatW × height × 4 bytes.
        if (finalX < -slatW - 60 || finalX > w + 60) {
          if (!hiddenCache[i]) {
            hiddenCache[i] = 1;
            el.style.visibility = "hidden";
          }
          continue;
        }
        if (hiddenCache[i]) {
          hiddenCache[i] = 0;
          el.style.visibility = "";
        }

        const d = (cx - w / 2) / (w / 2); // -1 … 1 across the stage
        const ad = Math.min(Math.abs(d), 1);
        if (ad < bestD) {
          bestD = ad;
          bestI = i;
        }

        // On the arc: the slat's own angle, and the depth that angle implies.
        // CURVE_DIR flips both together — the sagitta and the panel's turn have
        // to agree, or the pillars face the wrong way for the curve they sit on.
        const theta = d * ARC * CURVE_DIR;
        const z =
          CURVE_DIR * -CURVE_R * (1 - Math.cos(theta * (Math.PI / 180)));
        const ry = theta + whip[i] * WHIP_TILT;
        const sc = 1 - ad * SHRINK;
        el.style.transform = `translate3d(${finalX}px, 0, ${z}px) rotateY(${ry}deg) scale(${sc})`;

        // Hover scale, eased toward its target so it swells and settles instead
        // of stepping. Written to the frame, not the slat.
        const hTarget = i === hoverIndex && !dragging ? 1 : 0;
        hoverAmt[i] += (hTarget - hoverAmt[i]) * (1 - Math.exp(-dt / HOVER_TAU));
        const hv = Math.round(hoverAmt[i] * 1000) / 1000;
        if (hoverCache[i] !== hv) {
          hoverCache[i] = hv;
          const f = frames[i];
          const scale = 1 + hv * HOVER_GROW;
          if (f) {
            f.style.transform = hv < 0.001 ? "" : `scale(${scale})`;
          }
          // The caption's plate is anchored to the slat, not the frame, so it has
          // to be widened by the same factor or the enlarged picture sticks out
          // either side of it. See .wrail__meta::before.
          el.style.setProperty("--meta-scale", String(scale));
        }

        // Corner fade — smoothstepped so it eases in and out of full opacity
        // rather than ramping linearly, which still shows a seam at each end.
        const fromEdge = Math.min(cx + whip[i], w - (cx + whip[i]));
        const tEdge = Math.max(0, Math.min(1, fromEdge / edgeFade));
        const edge = Math.round(tEdge * tEdge * (3 - 2 * tEdge) * 1000) / 1000;
        if (edgeCache[i] !== edge) {
          edgeCache[i] = edge;
          el.style.setProperty("--edge", String(edge));
        }

        // ── The flare's copy ──
        // Handed over WHOLE, on the hairline curve: the GL copy now reproduces
        // this slat's own pose — the same rotateY, translateZ, scale and
        // perspective — so at the moment of the swap the two are identical and
        // the crossfade is invisible. That is only true because the arc is in
        // the shader; a flat quad could never match a slat turned 46deg and the
        // handoff always showed.
        if (tunnel) {
          // Measured from the slat's NEAREST EDGE, not its centre. A slat is
          // ~146px and the zone is ~144px, so keying off the centre means a
          // slat only hands over once it is almost entirely off-screen — the
          // warped edge then stands empty most of the time instead of being a
          // fixed region of the viewport that pictures travel through. Any part
          // of a slat entering the zone is enough; the warp is per-vertex and
          // is simply zero across the parts still outside it.
          const near = Math.min(finalX, w - (finalX + slatW));
          const img = slatImgs[i];
          if (handoffAt(near, w) > 0.001 && img) {
            glSlats.push({
              x: finalX,
              y: slatTop,
              w: slatW,
              h: slatH,
              theta: ry,
              z,
              scale: sc,
              img,
            });
          }
        }

        const shade = Math.round(ad * DIM * 100) / 100;
        if (shadeCache[i] !== shade) {
          shadeCache[i] = shade;
          const s = shades[i];
          if (s) s.style.opacity = String(shade);
        }

        // Inner counter-parallax — the picture drifts against the slat, so the
        // frame reads as a window rather than a printed card.
        const shift = shiftRefs.current[i];
        if (shift)
          shift.style.transform = `translate3d(${-d * slatW * PARALLAX}px, 0, 0)`;
      }

      // Only re-label once the rail is slow enough for the label to be worth
      // reading. Two reasons, both load-bearing: a spinning rail changes its
      // centre slat every ~100ms, and the foot caption is keyed on this index —
      // so it would re-mount faster than its 0.5s crossfade could finish and
      // simply never become visible. Holding the last value also stops the name
      // strobing through fourteen projects during a flick, which nobody can
      // read anyway. It settles onto the right one as the rail comes to rest.
      if (bestI !== focusRef.current && Math.abs(railVel) < FOCUS_SETTLE_VEL) {
        focusRef.current = bestI;
        setFocusIndex(bestI);
      }
      if (tunnel) {
        tunnel.render(
          glSlats,
          w,
          stage.clientHeight,
          slatTop + slatH / 2,
          slatH / 2,
          Math.min(window.devicePixelRatio || 1, 2),
        );
      }

      raf = requestAnimationFrame(frame);
    };

    // Pause entirely while the section is off-screen.
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
    io.observe(sectionRef.current ?? stage);
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      tunnel?.dispose();
      io.disconnect();
      stage.removeEventListener("pointerenter", onEnter);
      stage.removeEventListener("pointerleave", onLeave);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointerover", onOver);
      stage.removeEventListener("pointerout", onOut);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("resize", onResize);
    };
  }, [prefersReducedMotion, isTouch, flare]);

  const open = useCallback(
    (i: number) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (draggedRef.current) return; // the pointerup that ends a drag
      const frame = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
        ".wrail__frame",
      );
      // Hand over the ELEMENT, not a rect. The rail never stops drifting, so a
      // box measured here is out of date by the time the trail runs — the
      // clones flew to where this slat was at the moment of the click, not
      // where it is now. The hook re-measures at play time instead.
      trail.captureOrigin(frame ?? (e.currentTarget as HTMLElement));
      // Hold the rail from this instant until the closing trail has landed.
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

  const focused = PROJECTS[focusIndex];

  return (
    <section
      ref={sectionRef}
      id={anchor ? "work" : undefined}
      className="wrail"
      aria-label="Selected work"
    >
      {/* The label gets its own band above the pictures, the project name its
          own band below them — the work is sandwiched between the two. */}
      <div className="wrail__head">
        <span className="wrail__eyebrow">Selected Work</span>
        <span className="wrail__count">({PROJECTS.length})</span>
      </div>

      {/* Dark plane behind the pictures — see .wrail__scrim. */}
      <div className="wrail__scrim" aria-hidden />

      {/* The flare's canvas. Over the row, transparent except where a slat has
          been handed over, and never taking the pointer — the DOM slats keep
          every interaction. */}
      {flare && <canvas ref={glRef} className="wrail__gl" aria-hidden />}

      <div
        ref={stageRef}
        className={`wrail__stage${entered ? " is-in" : ""}${live ? " is-live" : ""}`}
      >
        {PROJECTS.map((p, i) => (
          <Slat
            key={p.name}
            project={p}
            index={i}
            eager={i < 4}
            registerRef={(el) => {
              slatRefs.current[i] = el;
            }}
            registerImgRef={(el) => {
              shiftRefs.current[i] = el;
            }}
            onSelect={open(i)}
          />
        ))}
      </div>

      <div className="wrail__foot" aria-live="polite">
        {/* Keyed on the index so the pair re-mounts and replays its crossfade
            as the rail brings the next project to centre. */}
        <div className="wrail__foot-meta" key={focusIndex}>
          <h3 className="wrail__foot-name">{focused.name}</h3>
          <span className="wrail__foot-service">{focused.service}</span>
        </div>
        <span className="wrail__foot-hint">
          {isTouch ? "Swipe · tap to open" : "Move to steer · click to open"}
        </span>
      </div>

      {/* Portaled to <body> so `fixed` resolves against the viewport — the
          section carries `perspective`, which would otherwise be the containing
          block and leave a gap top and bottom. */}
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
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={lightboxImgRef}
              src={PROJECTS[selected].src}
              alt={PROJECTS[selected].name}
              className="wrail__lightbox-img"
              crossOrigin="anonymous"
              // Starts clipped so there is no unclipped frame before the
              // entrance effect runs. The effect animates from here.
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
