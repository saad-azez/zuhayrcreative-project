"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import {
  CLIP,
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
    const bakes: (HTMLCanvasElement | null)[] = new Array(
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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
        // A fresh element every time on purpose: the tunnel uploads a source
        // once and keys the texture on the element, so repainting an old
        // canvas would leave a stale texture on the GPU.
        const c = document.createElement("canvas");
        c.width = Math.round(pw * dpr);
        c.height = Math.round(ph * dpr);
        const ctx = c.getContext("2d");
        if (!ctx) continue;
        ctx.scale(dpr, dpr);

        // object-fit: cover — the same crop the DOM applies and the tunnel
        // used to compute; baked in here, the canvas is exactly plate-shaped
        // and the tunnel's own cover math reduces to a no-op.
        const ia = im.naturalWidth / im.naturalHeight;
        const ba = pw / ph;
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
        ctx.drawImage(im, sx, sy, sw, sh, 0, 0, pw, ph);

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
        bakes[i] = c;
      }
    };
    void bake();

    let offset = 0;
    let loopW = 1;
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
    };
    measure();

    /** px per second. Slow enough to read as drift rather than as a carousel. */
    const DRIFT = 26;

    let dragging = false;
    let dragX = 0;
    let dragFrom = 0;
    let moved = 0;
    const down = (e: PointerEvent) => {
      if (frozenRef.current) return;
      dragging = true;
      dragX = e.clientX;
      dragFrom = offset;
      moved = 0;
      draggedRef.current = false;
      stage.classList.add("is-grabbing");
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      offset = dragFrom - (e.clientX - dragX);
      moved = Math.abs(e.clientX - dragX);
      // Past a click's worth of travel this is a drag, and the release that
      // ends it must not open a plate.
      if (moved > 8) draggedRef.current = true;
    };
    const up = () => {
      dragging = false;
      stage.classList.remove("is-grabbing");
    };
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

    const frame = () => {
      if (!running) {
        raf = 0;
        return;
      }
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!dragging && !frozenRef.current) offset += DRIFT * dt;
      offset = ((offset % loopW) + loopW) % loopW;
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;

      if (tunnel) {
        const stageBox = stage.getBoundingClientRect();
        // The canvas is TALLER than the stage (works-strip.css gives it ±20%
        // headroom) so the corner bars' bow can finish instead of being
        // sliced off at the stage bounds. All slat geometry below is offset
        // into the canvas's space.
        const glBox = canvas.getBoundingClientRect();
        const glOffY = stageBox.top - glBox.top;
        const vw = stageBox.width;
        const clipPx = CLIP * vw;
        glPlates.length = 0;

        // The split — see CaseStrip: each plate is divided in SPACE, the DOM
        // keeping the clipped middle and GL drawing the warped tails.
        for (let i = 0; i < plates.length; i++) {
          const p = plates[i];
          const r = p.getBoundingClientRect();
          const left = r.left - stageBox.left;
          const right = r.right - stageBox.left;

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
          const hUn = p.offsetHeight;
          const s0 = 1 + STRIP_BOW * dxc * dxc; // arc height at this bar
          // Arc slope per px of screen x → required edge-to-edge scale ratio.
          const q = (4 * STRIP_BOW * dxc) / vw / s0;
          const PERSP = 600;
          const theta = -Math.asin(Math.max(-0.6, Math.min(0.6, q * PERSP)));
          const tf =
            `scaleY(${s0.toFixed(4)}) perspective(${PERSP}px) ` +
            `rotateY(${((theta * 180) / Math.PI).toFixed(3)}deg) ` +
            `scaleX(${(1 / Math.cos(theta)).toFixed(4)})`;
          if (p.style.transform !== tf) p.style.transform = tf;

          const OVERLAP = 2;
          const inL = Math.max(0, Math.min(r.width, clipPx - left - OVERLAP));
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
          if (inL <= 0.5 && inR <= 0.5) continue;
          glPlates.push({
            x: left,
            // Untransformed layout geometry — the shader applies the arc.
            // The track fills the stage (inset 0), so offsetTop within it is
            // stage-space; glOffY carries it into the extended canvas.
            y: p.offsetTop + glOffY,
            w: r.width,
            h: hUn,
            // The composed plate — picture, scrim and caption as one surface —
            // so the caption travels through the flare with the image. Falls
            // back to the bare image until the bake lands.
            img: bakes[i % PROJECTS.length] ?? img,
          });
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
          Math.min(window.devicePixelRatio || 1, 2),
          1,
          1,
          STRIP_BOW,
        );
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.src}
                alt={p.name}
                draggable={false}
                // The enlarged view reuses this already-decoded image, and the
                // splash there uploads it into a WebGL texture — cross-origin
                // without this would taint the upload.
                crossOrigin="anonymous"
                loading="eager"
                decoding="async"
              />
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
