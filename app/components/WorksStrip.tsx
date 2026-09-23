"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import { useSceneLease } from "@/app/animations/hooks/useNearViewport";
import { releaseCanvasContext } from "@/app/lib/webglContexts";
import {
  CLIP_RATIO,
  flareBand,
  GLASS,
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
  const sectionRef = useRef<HTMLElement>(null);
  // ── Loaded on approach ──
  // The section's markup is in the page from the first byte (the head, the
  // plates, the #work anchor), but the expensive part of it — eight
  // photographs, sixteen baked textures and a WebGL flare that spans the
  // window — waits until the reader is within a viewport and a half. Until
  // then the pictures are lazy (so the server-rendered <img>s neither
  // preload nor fetch: on a slow phone they were sharing the pipe with the
  // app's own code) and the drive below is not started. Arming flips the
  // pictures to eager, which is a load trigger in its own right, and starts
  // the drive, which bakes once they have decoded. Never disarmed on a
  // desktop (see useNearViewport for why); on a phone disarmed again once
  // the reader is far away, which disposes the flare and gives its context
  // and baked textures back — see useSceneLease. The canvas is keyed on the
  // arming so a re-arm gets a fresh one: a released context cannot be
  // reused.
  const armed = useSceneLease(sectionRef, { label: "Work" });
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
  // enlarged image, which is uncovered underneath the last card rather than
  // wiped on beside it (see useImageTrail). Opacity is handled here rather
  // than by the trail — the stylesheet parks the image at 0 so there is no
  // one-frame flash at the final position.
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
    if (!armed) return;
    const stage = stageRef.current;
    const track = trackRef.current;
    const canvas = glRef.current;
    if (!stage || !track || !canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // `let`: the shader program is finished lazily, so a tunnel can still turn
    // out to be unusable after this (see the failure check in the frame).
    let tunnel = reduced ? null : createRailTunnel(canvas);
    tunnelRef.current = tunnel;
    // The slab is the picture now: with a tunnel, the DOM's own pictures
    // are hidden (works-strip.css, .is-glass) and the canvas carries them.
    // Without one — reduced motion, no WebGL — the DOM keeps showing them.
    stage.classList.toggle("is-glass", !!tunnel);

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
    // What was last written to each bar, so a frame can skip an unchanged
    // write by comparing plain strings. Reading `el.style.transform` back to
    // compare re-serialises the property out of the CSSOM on every bar on
    // every frame, which was the next-hottest thing in the loop.
    const lastTf: string[] = new Array(plates.length).fill("");
    const lastClip: string[] = new Array(plates.length).fill("");
    const lastShift: string[] = new Array(plates.length).fill("");

    // ── Baked textures ───────────────────────────────────────────────
    // The slab is drawn by GL from two textures per project:
    //
    // The PICTURE, cover-cropped into the overscanned box exactly as the DOM
    // sizes its <img> (.wstrip__shift, 140% of the bar) and baked at the
    // box's rendered size — so what the shader minifies is already at screen
    // resolution, instead of a 2000px photograph sampled down to a 130px bar
    // (which crawled with alias as the row moved). The parallax is NOT baked:
    // the shader slides the box under the bar every frame (TunnelSlat.pic),
    // so one bake serves every framing.
    //
    // The CAPTION — scrim, number, name — traced from its live DOM twin
    // (rects, computed fonts, letter-spacing, colours) rather than restated,
    // so the two sides of the clip seam cannot drift apart when the CSS is
    // tuned. Only the strip from the scrim's top to the bar's foot is baked,
    // at the bar's own coordinates; the shader lays it on the face of the
    // slab, faded in with the seam where the DOM's copy is clipped away.
    //
    // The picture bakes as soon as its photograph has decoded, and the caption
    // once the fonts are in (see the bake queue below). A bar that reaches the
    // screen first is baked on the spot in the frame loop; only if a bake is
    // impossible is the slab drawn from the bare <img> (cover-cropped in the
    // shader).
    const picBakes: (HTMLCanvasElement | null)[] = new Array(
      PROJECTS.length,
    ).fill(null);
    const capBakes: (HTMLCanvasElement | null)[] = new Array(
      PROJECTS.length,
    ).fill(null);
    /** Where each caption strip starts, as a fraction of the bar's height. */
    const capY0s = new Float32Array(PROJECTS.length);
    /**
     * Put a fresh bake in its slot and free the texture of the one it
     * replaces. The tunnel keys textures on the source element, so a re-bake
     * after every resize used to leave the previous sixteen on the GPU for the
     * life of the page.
     *
     * The new bake is NOT uploaded here. Uploading a 2D canvas in the same
     * task that drew it forces its drawing to finish synchronously (~4.5ms a
     * bake, measured); left to the first frame that draws it, the canvas has
     * long been flushed and the upload costs ~0.1ms.
     */
    /** The frozen strip's frame has been drawn and is being held. */
    let drawnStill = false;
    const swapTexture = (
      slot: (HTMLCanvasElement | null)[],
      i: number,
      next: HTMLCanvasElement,
    ) => {
      const prev = slot[i];
      slot[i] = next;
      if (prev && prev !== next) tunnel?.release(prev);
      drawnStill = false; // a new texture: the held frame is out of date
    };
    // Capped harder on a phone. A bar there is 37vw and nearly the whole
    // stage tall, so a dpr-2 bake of its 140% box is a ~400x1600 canvas per
    // project, on the device least able to spare the texture memory. 1.5
    // matches the canvas's own resolution there (see the render call).
    const bakeDpr = () =>
      Math.min(window.devicePixelRatio || 1, window.innerWidth <= 767 ? 1.5 : 2);

    // What each bake was made at, as the bar's w*10000+h, so a resize
    // re-bakes only what it actually changed. -1: not baked yet.
    const picSize = new Float64Array(PROJECTS.length).fill(-1);
    const capSize = new Float64Array(PROJECTS.length).fill(-1);
    const sizeKey = (i: number) => (plW[i] ?? 0) * 10000 + (plH[i] ?? 0);

    /**
     * Bake project `i`'s PICTURE into its overscanned box. Synchronous and
     * cheap — one drawImage — and it reads no layout: the bar's size comes
     * from measure()'s cache, so it is safe to call from inside a frame.
     */
    const bakePicture = (i: number): boolean => {
      const im = imgs[i];
      // UNTRANSFORMED size — the plates carry the arc's skew/scale as a
      // transform, and the GL rects are untransformed too (the shader bows
      // them); a BCR here would bake the bounding box of the skewed plate and
      // the texture would no longer match its rect.
      const pw = plW[i] ?? 0;
      const ph = plH[i] ?? 0;
      if (!tunnel || !im || !im.complete || !im.naturalWidth) return false;
      if (pw < 1 || ph < 1) return false;
      const dpr = renderDpr; // cached: this can run inside a frame
      // Fresh elements every time on purpose: the tunnel uploads a source
      // once and keys the texture on the element, so repainting an old
      // canvas would leave a stale texture on the GPU.
      //
      // object-fit: cover — the same crop the DOM applies, against the
      // OVERSCANNED box (.wstrip__shift), not the bar: that is the element the
      // DOM sizes its <img> against, so cropping to the bar here would frame
      // the photo differently from the fallback the DOM shows.
      const bw = pw * OVERSCAN;
      const c = document.createElement("canvas");
      c.width = Math.round(bw * dpr);
      c.height = Math.round(ph * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return false;
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingQuality = "high";
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
      ctx.drawImage(im, sx, sy, sw, sh, 0, 0, bw, ph);
      // Proof the photograph actually landed, before the bake is used. On an
      // iPhone a bar came out as a black slab (glass rim and all) while its
      // neighbours were fine (client's screenshot, 23 Sep): the bake was
      // uploaded blank — drawn from a photo that was loaded but not yet
      // decoded, or uploaded in the same task that drew it, before the
      // canvas had finished. The texture is cached for good, so it stayed
      // black. Reading one pixel back makes the drawing finish now, and a
      // photograph is opaque, so a transparent pixel means nothing was
      // drawn: skip this bake and try again next frame (the bar is drawn
      // from the photograph itself until then).
      try {
        const px = ctx.getImageData(c.width >> 1, c.height >> 1, 1, 1).data;
        if (px[3] === 0) return false;
      } catch {
        // Unreadable (never for these same-origin photos): trust it.
      }
      swapTexture(picBakes, i, c);
      picSize[i] = pw * 10000 + ph;
      // The full-size photograph was only ever a stand-in until this bake
      // landed. Its texture is the biggest thing this section can put on the
      // GPU (a mipmapped photo per COPY of the plate, three per project), and
      // nothing samples it again once the bake exists.
      for (let j = i; j < imgs.length; j += PROJECTS.length) {
        const raw = imgs[j];
        if (raw) tunnel.release(raw);
      }
      return true;
    };

    /** Bake project `i`'s CAPTION strip. Needs the fonts; reads layout. */
    const bakeCaption = (i: number) => {
      const plate = plates[i];
      const meta = plate?.querySelector<HTMLElement>(".wstrip__meta");
      if (!tunnel || !plate || !meta) return;
      const pw = plW[i] ?? 0;
      const ph = plH[i] ?? 0;
      if (pw < 1 || ph < 1) return;
      const dpr = renderDpr; // cached: this can run inside a frame
      // Offset-based, like the plate size: the meta's place in the plate's
      // own (untransformed) space.
      const top = meta.offsetTop;
      const strip = ph - top;
      if (strip < 1) return;
      const c = document.createElement("canvas");
      c.width = Math.round(pw * dpr);
      c.height = Math.round(Math.max(1, strip) * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      // Drawn in PLATE coordinates, so the tracing below is the DOM's own
      // numbers; the canvas simply starts at the strip's top.
      ctx.translate(0, -top);
      const g = ctx.createLinearGradient(0, ph, 0, top);
      g.addColorStop(0, "rgba(0, 0, 0, 0.55)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, top, pw, strip);

      for (const span of Array.from(meta.children) as HTMLElement[]) {
        if (!span.textContent || span.offsetParent === null) continue;
        const cs = getComputedStyle(span);
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        (
          ctx as CanvasRenderingContext2D & { letterSpacing?: string }
        ).letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
        ctx.fillStyle = cs.color;
        ctx.textBaseline = "alphabetic";
        const text =
          cs.textTransform === "uppercase"
            ? span.textContent.toUpperCase()
            : span.textContent;
        // A span's offsetTop is its border-box top — baseline minus the
        // font's ascent, the same metric the canvas reports — so this puts
        // the glyphs where the DOM put them. Spans position against the META
        // (their offsetParent, absolutely positioned), which positions
        // against the plate.
        const ascent =
          ctx.measureText(text).fontBoundingBoxAscent ??
          parseFloat(cs.fontSize) * 0.8;
        ctx.fillText(
          text,
          meta.offsetLeft + span.offsetLeft,
          meta.offsetTop + span.offsetTop + ascent,
        );
      }
      swapTexture(capBakes, i, c);
      capY0s[i] = top / ph;
      capSize[i] = pw * 10000 + ph;
    };

    // ── The bake queue ──
    // Each project is baked as soon as ITS OWN photograph has decoded, one
    // project per frame. It used to wait for all eight photographs and the
    // fonts before baking anything, and then take eight more frames — which
    // on a phone outlasted the approach: the section arms a viewport and a
    // half out, and a flick covers that in well under a second. Every bar
    // that arrived before its bake was then drawn from its FULL-SIZE photo,
    // uploaded and mipmapped in the frame it scrolled in (10ms each on a
    // desktop CPU, several times that on a phone). The picture no longer
    // waits for the fonts either; only the caption, which traces them, does.
    let fontsReady = false;
    let disposed = false;
    const queue: number[] = [];
    let pumpRaf = 0;
    const pump = () => {
      pumpRaf = 0;
      if (disposed) return;
      const i = queue.shift();
      if (i !== undefined) {
        if (picSize[i] !== sizeKey(i)) bakePicture(i);
        if (fontsReady && capSize[i] !== sizeKey(i)) bakeCaption(i);
      }
      if (queue.length) pumpRaf = requestAnimationFrame(pump);
    };
    const enqueue = (i: number) => {
      if (disposed || !tunnel) return;
      if (!queue.includes(i)) queue.push(i);
      if (!pumpRaf) pumpRaf = requestAnimationFrame(pump);
    };
    const bakeAll = () => {
      for (let i = 0; i < PROJECTS.length; i++) enqueue(i);
    };
    /** Kicked off once measure() has run — the bakes size from its cache. */
    const startBakes = () => {
      if (!tunnel) return;
      bakesStarted = true;
      for (let i = 0; i < PROJECTS.length; i++) {
        const im = imgs[i];
        if (!im) continue;
        im.decode()
          .catch(() => {})
          .then(() => enqueue(i));
      }
      document.fonts.ready.then(() => {
        fontsReady = true;
        bakeAll();
      });
    };

    let offset = 0;
    let loopW = 1;
    /** The canvas's resolution. See the render call for why it is cached. */
    let renderDpr = 1;
    // devicePixelRatio can change with no change of size (a window dragged to
    // another monitor, browser zoom), which the ResizeObserver would not see.
    const onWinResize = () => {
      renderDpr = bakeDpr();
      drawnStill = false;
    };
    window.addEventListener("resize", onWinResize);

    // ── A lost context ──
    // The page runs more WebGL contexts than a phone allows, and the browser
    // takes the oldest back without asking (see lib/webglContexts). Losing
    // this one used to leave the glass switched ON over a canvas that no
    // longer draws: the DOM pictures stayed hidden under .is-glass and every
    // bar went black, caption and shadow only, for good. Now a loss drops to
    // exactly what a missing tunnel shows — the plain DOM pictures — at
    // once, and a restored context gets the glass back. preventDefault is
    // what allows the browser to restore it at all.
    let bakesStarted = false;
    const onLost = (e: Event) => {
      e.preventDefault();
      if (!tunnel) return;
      tunnel.dispose();
      tunnel = null;
      tunnelRef.current = null;
      stage.classList.remove("is-glass");
      // The DOM's parallax takes over again: rewrite every shift.
      lastShift.fill("");
      drawnStill = false;
    };
    const onRestored = () => {
      if (disposed || tunnel || reduced) return;
      tunnel = createRailTunnel(canvas);
      tunnelRef.current = tunnel;
      stage.classList.toggle("is-glass", !!tunnel);
      drawnStill = false;
      // The bakes are 2D canvases and survived; the new context uploads
      // them on first use. Only a loss that came before they started
      // leaves them to begin now.
      if (tunnel && !bakesStarted) startBakes();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    let stageLeft = 0;
    let stageWCached = 1;
    /* The canvas's frame around the stage, cached with the rest: the canvas
       is taller than the stage by a fixed headroom (works-strip.css), so
       where the stage sits inside it and how tall each is only change on
       resize. They were two getBoundingClientRect calls a frame, each landing
       after the previous frame's style writes and so each forcing a layout
       — the same bill the offset reads below used to run up. */
    let glOffY = 0;
    let glH = 1;
    let stageH = 1;
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
      renderDpr = bakeDpr();
      // ── One copy's width, EXACTLY ──
      // The wrap is `offset` taken modulo this, and the copies are identical,
      // so a wrap is invisible if and only if this is the true pitch of one
      // copy. It used to be measured between the two copies' first plates'
      // bounding rects — and those rects carry each plate's own TRANSFORM:
      // its whip translate (up to ~30px while steering, and different for
      // the two plates, because the whip fans with distance from the
      // pointer) and its cylinder rotation (different too, because the two
      // sit at different places on the arc). So the measured width was off
      // by tens of px, and by a different amount every time it was taken —
      // it was retaken on every pointerover — so the row snapped by that
      // error at every wrap, and with the boundary itself jittering under a
      // moving cursor it could wrap back and forth on consecutive frames.
      // Measured: 46 wraps in five seconds of sweeping, a median 18px snap
      // each, up to 55px. That was "the images suddenly change positions".
      //
      // The pitch is layout, not paint: a plate's used width plus the flex
      // gap, both fractional from computed style (offsetLeft would round to
      // whole px, and that rounding is a visible tick at the wrap).
      const plateCs = getComputedStyle(plates[0]);
      const gapPx = parseFloat(getComputedStyle(track).columnGap) || 0;
      const pitch = parseFloat(plateCs.width) + gapPx;
      loopW =
        Number.isFinite(pitch) && pitch > 1
          ? pitch * PROJECTS.length
          : Math.max(1, track.scrollWidth / 3);
      // Cached: the whip is anchored on the pointer in STAGE space and a
      // pointermove must not pay for a layout read.
      const stageBox = stage.getBoundingClientRect();
      const glBox = canvas.getBoundingClientRect();
      stageLeft = stageBox.left;
      stageWCached = Math.max(1, stage.clientWidth);
      glOffY = stageBox.top - glBox.top;
      glH = Math.max(1, glBox.height);
      stageH = Math.max(1, stageBox.height);
      // One batch of reads with no writes in between — one layout for all
      // of them instead of one apiece.
      for (let i = 0; i < plates.length; i++) {
        const el = plates[i];
        plW[i] = el.offsetWidth;
        plH[i] = el.offsetHeight;
        plL[i] = el.offsetLeft;
        plT[i] = el.offsetTop;
      }
      // The slab's corner radius, for the DOM plate's drop shadow to match
      // (the silhouette itself is the shader's). The same rule the tunnel
      // applies: a fraction of the bar's width, never past half a side.
      const r = Math.min(
        (plW[0] ?? 0) * GLASS.RADIUS,
        (plW[0] ?? 0) / 2,
        (plH[0] ?? 0) / 2,
      );
      stage.style.setProperty("--wstrip-r", `${r.toFixed(1)}px`);
      drawnStill = false; // new geometry: the held frame is out of date
    };
    measure();
    startBakes();

    // ── Tunables — the whip rail's, restored ─────────────────────────────
    // The strip took over the work section with a bare constant drift, and
    // that is what "slower" was: the rail's resting speed was this same 26,
    // but browsing it added STEER on top, so a cursor anywhere off centre had
    // the row moving at up to ~326px/sec. Losing the steer took the section
    // from a row you push around to a row that creeps.
    /**
     * px per second, at rest.
     *
     * 60, not the rail's 26. Measured on the built site, 26px/s moved a
     * 9vw bar past a point in five seconds — slow enough that a still
     * cursor reads as a stalled section rather than a calm one, which is
     * what "the work animation looks slow" was. The steer was never the
     * problem: the same measurement put the row at 315px/s with the
     * cursor at the rim, twelve times its resting speed and working
     * exactly as written.
     *
     * At 60 a bar passes in about two seconds — plainly alive at a
     * glance, still slow enough to read a caption without chasing it.
     * STEER rides on top of this, so the rim now reaches ~360px/s.
     */
    const DRIFT = 60;
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
      hotIdx = -1;
    };

    // ── The hover swell, in the drive ──
    // A hovered bar grows a little (SWELL, the stylesheet's old 86% → 88%).
    // It used to be a CSS `height` transition, and a height change is layout:
    // every frame of the 0.38s swell re-laid-out the whole row and re-cropped
    // the bar's photograph (object-fit: cover at a new height is a fresh
    // raster of a large image), for every bar the pointer crossed — and it
    // changed offsetHeight/offsetTop, so every crossing also forced a full
    // re-measure to keep the flare's copies honest. Here it is a scaleY
    // folded into the SAME transform the arc is written into, eased in the
    // frame loop, and handed to the GL copy through the slat's own scaleY —
    // so the DOM half and the flare half of a hovered rim bar agree by
    // construction, which the height transition never did mid-swell. The
    // type stretches by the swell's 2%; the arc already stretches it by up
    // to 20% at the rim, so that is nothing new.
    const SWELL = 88 / 86 - 1;
    const SWELL_TAU = 0.11; // sec — the ease of the old 0.38s curve
    const swell = new Float32Array(plates.length);
    let hotIdx = -1;
    const plateIndex = new Map<Element, number>();
    plates.forEach((p, i) => plateIndex.set(p, i));
    const plateOf = (t: EventTarget | null) =>
      t instanceof Element ? t.closest("[data-plate]") : null;
    const hotOver = (e: PointerEvent) => {
      const p = plateOf(e.target);
      hotIdx = p ? (plateIndex.get(p) ?? -1) : -1;
    };
    const hotOut = (e: PointerEvent) => {
      // Leaving a plate for something that is not inside it: no plate is hot.
      const from = plateOf(e.target);
      const to = plateOf(e.relatedTarget);
      if (from && to !== from) hotIdx = -1;
    };
    track.addEventListener("pointerover", hotOver);
    track.addEventListener("pointerout", hotOut);

    stage.addEventListener("pointerenter", enter);
    stage.addEventListener("pointerleave", leave);
    stage.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);

    const ro = new ResizeObserver(() => {
      measure();
      // The bakes are sized to the plate's rendered box, so they go stale the
      // moment it changes. The queue re-bakes only projects whose bar size
      // actually moved, and a burst of resize callbacks collapses into it
      // (a project already queued is not queued twice).
      bakeAll();
    });
    ro.observe(stage);
    ro.observe(track);

    let running = false;
    let raf = 0;
    let lastTrackTf = "";
    let last = performance.now();
    const glPlates: TunnelSlat[] = [];


    const frame = () => {
      if (!running) {
        raf = 0;
        return;
      }
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      const frameGap = now - last;
      last = now;

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
      const trackTf = `translate3d(${-offset}px, 0, 0)`;
      if (trackTf !== lastTrackTf) {
        track.style.transform = trackTf;
        lastTrackTf = trackTf;
      }

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


      // The swell eases toward its target for every bar, hot or cooling.
      // The stylesheet gated its hover on the drag the same way: a bar
      // swelling under a cursor busy flinging the strip reads as noise.
      const swellK = 1 - Math.exp(-dt / SWELL_TAU);
      for (let i = 0; i < plates.length; i++) {
        const target = i === hotIdx && !dragging && !isTouchRef.current ? 1 : 0;
        swell[i] += (target - swell[i]) * swellK;
        if (swell[i] < 0.002 && target === 0) swell[i] = 0;
      }

      // ── Held still: draw once, then stop drawing ──
      // While an image is open the row is frozen, and once the whip has
      // unwound every frame would be the same frame: the same transforms, the
      // same clips, the same slab picture. The strip is still on show — the
      // lightbox frosts it rather than covering it — so it cannot simply stop,
      // but it can stop REDRAWING: a WebGL canvas that is not drawn to keeps
      // presenting its last frame. That hands the frame budget to the
      // lightbox's own blur and trail for as long as it is open. Anything
      // that could change the picture (the freeze lifting, a resize, a new
      // bake) clears `drawnStill` and the next frame draws as normal.
      let still = frozenRef.current && !dragging && vel === 0;
      if (still) {
        for (let c = 0; c < WHIP_COLS && still; c++) {
          if (Math.abs(whip[c]) > 0.01 || Math.abs(whipVel[c]) > 0.01) still = false;
        }
        for (let i = 0; i < plates.length && still; i++) {
          if (swell[i] !== 0 && swell[i] < 0.998) still = false;
        }
      }
      if (still && drawnStill) {
        raf = requestAnimationFrame(frame);
        return;
      }
      drawnStill = still;

      // The program is linked lazily; if it failed, fall back to exactly
      // what a missing tunnel shows — the plain DOM pictures, no glass.
      if (tunnel?.failed()) {
        tunnel.dispose();
        tunnel = null;
        tunnelRef.current = null;
        stage.classList.remove("is-glass");
      }

      if (tunnel) {
        // The canvas is TALLER than the stage (works-strip.css gives it ±20%
        // headroom) so the corner bars' bow can finish instead of being
        // sliced off at the stage bounds. All slat geometry below is offset
        // into the canvas's space — glOffY, cached in measure().
        const vw = stageWCached;
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

        // The split — see CaseStrip: each plate is divided in SPACE. GL now
        // draws the whole slab (picture, glass, and the warped tails); the
        // DOM keeps the caption, the hover vignette and the drop shadow,
        // clipped back to the middle so its caption hands over to the
        // baked one at the seam exactly as before.
        for (let i = 0; i < plates.length; i++) {
          const p = plates[i];
          // LAYOUT geometry, not a bounding rect. The bars now carry a whip
          // translate as part of the same transform the arc is written into,
          // so reading a BCR here would feed last frame's whip back into this
          // frame's arc — a loop that rings. offsetLeft less the track's drift
          // is stage space by construction (the track fills the stage), and
          // the projection moves x by ~1px at the rim, inside the clip's own
          // overlap.
          const wUn = plW[i];
          const hUn = plH[i];
          const bare = plL[i] - offset;
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
          // …and the hover swell on top, about the same centre. The arc's
          // slope (q, below) is the row's curve, not the bar's size, so the
          // swell stays out of it.
          const sy = s0 * (1 + SWELL * swell[i]);
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
            `scaleY(${sy.toFixed(4)}) perspective(${PERSP}px) ` +
            `rotateY(${((theta * 180) / Math.PI).toFixed(3)}deg) ` +
            `scaleX(${(1 / Math.cos(theta)).toFixed(4)})`;
          if (lastTf[i] !== tf) {
            p.style.transform = tf;
            lastTf[i] = tf;
          }

          // ── The moving-image illusion ──
          // The picture drifts against its bar as the bar crosses the window,
          // so the bar reads as a window onto something behind the page rather
          // than a printed card sliding past. Overscanned in the stylesheet by
          // exactly enough that this swing never pulls an edge into view.
          //
          // ── …and held before the flare takes over ──
          // `dTail` is where the tail starts: the bar's centre when its
          // trailing edge first reaches the clip line, in the same -1…1 units
          // as dxc. The drift eases to its full swing by then and holds, so a
          // bar turning through the flare is not sliding its picture as well.
          // (It used to be load-bearing — the tail's bake could only hold one
          // framing per side. The slab is drawn from ONE bake per project
          // with the box slid under it every frame, TunnelSlat.pic, so what
          // is kept here is the motion, not a constraint.)
          const dTail = Math.max(0.06, 1 - (2 * clipPx + wUn) / vw) * 0.9;
          const u = Math.min(1, Math.abs(dxc) / dTail);
          const eased = u * u * (3 - 2 * u);
          const px = -Math.sign(dxc) * eased * wUn * PARALLAX;
          // The DOM's copy moves only when it is the one on show. Under a
          // tunnel it is hidden (.is-glass) and the slab carries the parallax
          // itself (`pic` below), so writing its transform every frame was a
          // style recalc per bar per frame for a box no one can see.
          const shiftEl = tunnel ? null : shifts[i];
          if (shiftEl) {
            const sTf = `translate3d(${px.toFixed(2)}px, 0, 0)`;
            if (lastShift[i] !== sTf) {
              shiftEl.style.transform = sTf;
              lastShift[i] = sTf;
            }
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
          if (lastClip[i] !== clip) {
            p.style.clipPath = clip;
            lastClip[i] = clip;
          }

          const img = imgs[i];
          if (!img) continue;
          if (right <= 0 || left >= vw) continue;
          const k = i % PROJECTS.length;
          // A bar on screen before its bake: bake it now. One drawImage into
          // a bar-sized canvas is far cheaper than the alternative, which was
          // uploading and mipmapping the full-size photograph in this frame.
          if (!picBakes[k]) bakePicture(k);
          glPlates.push({
            // Untransformed layout geometry on BOTH axes. The track fills
            // the stage and is translated by -offset, so offsetLeft/offsetTop
            // less that drift is stage-space; glOffY carries y into the
            // extended canvas. The shader applies the same perspective map
            // the DOM plate carries, so it needs the same input the DOM had.
            x: left,
            y: plT[i] + glOffY,
            w: wUn,
            h: hUn,
            // sin(theta)/d — the exact horizontal term of the plate's own
            // `perspective(PERSP) rotateY(theta) scaleX(1/cos theta)`.
            skew,
            scaleY: sy,
            // The picture in its overscanned box, slid by this frame's
            // parallax — the bake's box is OVERSCAN bars wide and the bar's
            // left edge sits (OVERSCAN-1)/2 bars in, less the shift. Falls
            // back to the bare image until the bake lands.
            img: picBakes[k] ?? img,
            pic: { u0: (OVERSCAN - 1) / 2 - px / wUn, su: 1 / OVERSCAN },
            // The caption on the face, taking over from the DOM's past the
            // clip line, so the type travels through the flare with the bar.
            cap: capBakes[k] ?? undefined,
            capY0: capY0s[k],
            // …drawn exactly where the DOM's caption has been clipped away.
            // The DOM runs OVERLAP px past the seam, and the scrim is
            // translucent: with the baked caption fading in at the seam the
            // two scrims stacked across that strip, a dark line down every
            // bar entering the lens.
            capClip: clip ? { l: inL, r: inR } : null,
            // The hover vignette, on the slab rather than the DOM (whose copy
            // the seam would cut); `swell` is the hover, eased.
            vignette: swell[i],
            glass: true,
          });
        }
        tunnel.render(
          glPlates,
          vw,
          glH,
          // The fan's centreline is the STAGE's middle, expressed in the
          // canvas's space — with symmetric headroom the two coincide, but
          // derive it rather than assume.
          glOffY + stageH / 2,
          stageH / 2,
          // ── The flare's own resolution, capped harder on a phone ──
          // This canvas is the section's biggest per-frame bill: it spans the
          // full window and 140% of the stage, so on a 390x844 phone at dpr 2
          // that is 1.5M fragments, every one of them running the dispersion
          // shader, every frame the section is on screen. What it draws there
          // is a soft, heavily-warped red dispersion — the one thing on the
          // page with no fine detail to lose — so dropping it to 1.5 costs
          // nothing visible and takes 44% of the fill with it. Desktop keeps
          // 2: the tail there carries a legible slice of photograph and its
          // caption right up to the seam. Phones: 1.25 — the GPU is what the
          // phone's frame rate is short of in this section (its JavaScript
          // measured under a millisecond a frame), and the flare's fill is
          // the biggest fragment bill on screen; at 1.25 it is 30% smaller
          // than at 1.5, on content with no edge to soften. Back to 1.5 now
          // that the canvas carries the photographs themselves and not only
          // the dispersed tail: at 1.25 the pictures went visibly soft.
          //
          // CACHED (bakeDpr, refreshed in measure() and on resize), never
          // read here: `window.innerWidth` asks for an up-to-date viewport,
          // and this call comes straight after the loop above has written
          // every visible bar's transform and clip — so reading it here forced
          // a full style recalc in the middle of every frame. Measured, it was
          // 81% of this function's own time.
          renderDpr,
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
      raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(
      (entries) => {
        // The LAST entry, not the first. A batch can carry more than one
        // record for the stage — a fast scroll or a layout shift delivers
        // "in" and "out" together — and the first is then the stale one: it
        // either left the strip rendering off screen for good, or stopped it
        // while it was in view.
        const entry = entries[entries.length - 1];
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
      disposed = true;
      if (pumpRaf) cancelAnimationFrame(pumpRaf);
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      track.removeEventListener("pointerover", hotOver);
      track.removeEventListener("pointerout", hotOut);
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointerenter", enter);
      stage.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("resize", onWinResize);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      tunnel?.dispose();
      tunnelRef.current = null;
      stage.classList.remove("is-glass");
      releaseCanvasContext(canvas);
    };
  }, [armed]);

  return (
    <section
      ref={sectionRef}
      className="wstrip cstrip"
      id="work"
      aria-label="Selected work"
    >
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
                  loading={armed ? "eager" : "lazy"}
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

        <canvas key={armed ? "armed" : "idle"} ref={glRef} className="cstrip__gl" aria-hidden />
      </div>

      {/* The enlarged view — the rail's lightbox, reused wholesale. Portaled
          to <body> so `fixed` resolves against the viewport. */}
      {selected !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={lightboxRef}
            className="wrail__lightbox"
            data-lenis-prevent
            role="dialog"
            aria-modal="true"
            aria-label={PROJECTS[selected].name}
            onClick={closeLightbox}
          >
            <button
              type="button"
              className="wrail__lightbox-close liquid-glass lg-drop lg-gulp"
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
