"use client";

import { useEffect, useRef } from "react";
import {
  CLIP,
  createRailTunnel,
  type RailTunnel,
  type TunnelSlat,
} from "./railTunnel";
import "@/app/styles/case-strip.css";

/**
 * Case strip — a horizontally-driven case study laid out like the reference:
 * a masthead row across the top, then a full-bleed row of large plates that
 * drags sideways, with the sheet flaring into depth at both edges of the
 * window.
 *
 * The flare is the reference's own vertex shader (see railTunnel.ts): the
 * plates' Y is scaled about one shared centreline by an amount that rises
 * toward the left and right edges of the WINDOW, while X passes through
 * untouched. Because the warp is a function of screen X and nothing else, the
 * whole row deforms as a single sheet — neighbouring plates stay neighbours
 * and can never ride over one another.
 *
 * Layout and motion follow the reference; the brand and copy are this site's.
 * Reproducing another studio's masthead and their client's words on a live site
 * is not a thing to ship, and none of it is what the effect is.
 */

interface Plate {
  src: string;
  alt: string;
}

const PLATES: Plate[] = [
  { src: "/club/slide-1.jpg", alt: "Campaign still" },
  { src: "/club/slide-2.jpg", alt: "Product still" },
  { src: "/club/slide-3.jpg", alt: "Identity system" },
  { src: "/club/slide-4.jpg", alt: "Environmental print" },
  { src: "/club/slide-5.jpg", alt: "Art direction" },
  { src: "/club/slide-6.jpg", alt: "Packaging" },
  { src: "/club/slide-7.jpg", alt: "Editorial spread" },
  { src: "/club/slide-8.jpg", alt: "Motion frame" },
];

export default function CaseStrip() {
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const tunnelRef = useRef<RailTunnel | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const track = trackRef.current;
    const canvas = glRef.current;
    if (!stage || !track || !canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tunnel = reduced ? null : createRailTunnel(canvas);
    tunnelRef.current = tunnel;

    // Queried once, up front: `measure()` below needs them to size the loop,
    // and it runs before the render loop is even created.
    const plates = Array.from(
      track.querySelectorAll<HTMLElement>("[data-plate]"),
    );
    const imgs = plates.map((p) => p.querySelector("img"));

    // ── Horizontal drive ──
    // The strip plays on its own and can be dragged; it no longer takes the
    // wheel. Hijacking the wheel meant the section had to be scrolled THROUGH
    // to see anything, and it fought the page scroll on the way past.
    //
    // The plate list is rendered TWICE (see PLATES.concat(PLATES) below) and
    // the offset wraps at one set's width, so the row is endless: whatever
    // leaves the left edge is already re-entering on the right. Without the
    // second copy the drift would simply run out of strip and stop.
    let offset = 0;
    let loopW = 1;
    const measure = () => {
      // Measured between the two copies' first plates, NOT scrollWidth / 2.
      // scrollWidth is rounded to a whole pixel, so on any fractional layout
      // the wrap lands a fraction off and the whole row jumps by that fraction
      // once per loop — a visible tick at the join. Rects are fractional.
      const first = plates[0]?.getBoundingClientRect();
      const second = plates[PLATES.length]?.getBoundingClientRect();
      loopW =
        first && second
          ? Math.max(1, second.left - first.left)
          : Math.max(1, track.scrollWidth / 2);
    };
    measure();

    /** px per second. Slow enough to read as drift rather than as a carousel. */
    const DRIFT = 26;

    let dragging = false;
    let dragX = 0;
    let dragFrom = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      dragX = e.clientX;
      dragFrom = offset;
      stage.classList.add("is-grabbing");
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      offset = dragFrom - (e.clientX - dragX);
    };
    const up = () => {
      dragging = false;
      stage.classList.remove("is-grabbing");
    };
    stage.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);

    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    ro.observe(track);

    // Paused while off-screen: this owns a WebGL context and a rAF, and the
    // page has several other scenes competing for both.
    let running = false;
    let raf = 0;
    let last = performance.now();
    const glPlates: TunnelSlat[] = [];

    const frame = () => {
      if (!running) {
        raf = 0;
        return;
      }
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Time-based, not per-frame: a per-frame step drifts at whatever rate the
      // display happens to run at, so the same strip crawls on 60Hz and races
      // on 144Hz.
      if (!dragging) offset += DRIFT * dt;
      // Wrap into [0, loopW). The second copy of the plate list makes this
      // invisible — the row simply continues.
      offset = ((offset % loopW) + loopW) % loopW;
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;

      if (tunnel) {
        const stageBox = stage.getBoundingClientRect();
        const vw = stageBox.width;
        const clipPx = CLIP * vw;
        glPlates.length = 0;

        // ── The split ──
        // Each plate is divided in SPACE, not faded in time. The DOM keeps the
        // middle and is clipped back to it; GL draws the two tails, warped, and
        // the fragment's `seam` mask makes the tail opaque exactly where the
        // clip begins. Nothing is ever drawn twice, and no plate is ever hidden
        // as a whole — which is what made the earlier crossfade show a warped
        // copy over an unwarped one.
        for (let i = 0; i < plates.length; i++) {
          const p = plates[i];
          const r = p.getBoundingClientRect();
          const left = r.left - stageBox.left;
          const right = r.right - stageBox.left;

          // 2px of overlap: the clip is solved for where the GL tail reaches
          // 0.99 alpha, so clipping the DOM exactly there leaves a hairline
          // where the tail is not quite opaque and the DOM is already gone — a
          // faint 1%-translucent line down the join. Letting the DOM run a
          // couple of pixels further under the tail closes it, and costs
          // nothing because the tail is drawn over the top.
          const OVERLAP = 2;
          const inL = Math.max(
            0,
            Math.min(r.width, clipPx - left - OVERLAP),
          );
          const inR = Math.max(
            0,
            Math.min(r.width, right - (vw - clipPx) - OVERLAP),
          );
          const clip =
            inL > 0.5 || inR > 0.5
              ? `inset(0 ${inR.toFixed(2)}px 0 ${inL.toFixed(2)}px)`
              : "";
          if (p.style.clipPath !== clip) p.style.clipPath = clip;

          const img = imgs[i];
          if (!img) continue;
          if (right <= 0 || left >= vw) continue;
          // Only plates that actually reach into a zone need a tail drawn.
          if (inL <= 0.5 && inR <= 0.5) continue;
          glPlates.push({
            x: left,
            y: r.top - stageBox.top,
            w: r.width,
            h: r.height,
            img,
          });
        }
        // No end gates here: the strip is endless, so it never runs out of
        // content on either side and both edges always have something bending
        // away past them. They stay in railTunnel for callers that do have ends.
        tunnel.render(
          glPlates,
          vw,
          stageBox.height,
          stageBox.height / 2,
          stageBox.height / 2,
          Math.min(window.devicePixelRatio || 1, 2),
        );
      }
      raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
        if (running && !raf) raf = requestAnimationFrame(frame);
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
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      tunnel?.dispose();
      tunnelRef.current = null;
    };
  }, []);

  return (
    <section className="cstrip" aria-label="Selected case study">
      {/* ── Masthead ── three columns, as in the reference: mark, then the
          year and title, then the summary and the disciplines. */}
      <header className="cstrip__head">
        <div className="cstrip__mark">
          <span className="cstrip__dot" aria-hidden />
          ZUHAYR
        </div>

        <div className="cstrip__title">
          <span className="cstrip__year">2026</span>
          <h2 className="cstrip__name">Patch</h2>
        </div>

        <div className="cstrip__meta">
          <p className="cstrip__blurb">
            Patch is an app blocker with a body. A small silicone object you tap
            your phone against to lock your apps. We designed the product, the
            brand, the app, and how it shows up in the world.
          </p>
          <ul className="cstrip__disciplines">
            <li>Product design</li>
            <li>Industrial design</li>
            <li>Branding</li>
          </ul>
        </div>
      </header>

      {/* ── The strip ──
          The white sheet's inner corners are rounded, as in the reference, so
          the plates below appear to sit in a cut-out rather than butting
          against a hard edge. */}
      <div className="cstrip__stage" ref={stageRef}>
        <div className="cstrip__track" ref={trackRef}>
          {/* Rendered twice. The offset wraps at one set's width, so what
              leaves the left edge is already re-entering on the right and the
              drift never runs out of strip. */}
          {PLATES.concat(PLATES).map((p, i) => (
            <figure className="cstrip__plate" data-plate key={`${p.src}-${i}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.src}
                alt={p.alt}
                draggable={false}
                loading="eager"
                decoding="async"
              />
            </figure>
          ))}
        </div>

        {/* The flare. Transparent everywhere except where the sheet bends. */}
        <canvas ref={glRef} className="cstrip__gl" aria-hidden />
      </div>
    </section>
  );
}
