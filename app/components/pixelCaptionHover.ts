"use client";

/**
 * Hover pixelation for the work strip's plate captions.
 *
 * The gallery headline's pixel sweep (VerticalGallery/pixelTextReveal.ts),
 * adapted for hover feedback: the caption is rasterised into a canvas, drawn
 * as chunky blocks in the TARGET colour, and stepped coarse → fine until it
 * lands sharp — at which point the real text (already switched to that colour
 * by the caller) takes over and the swap shows nothing. Entering a plate
 * sweeps the caption to the brand red; leaving sweeps it back to white.
 *
 * Differences from the original, all hover-driven:
 *   - rasterises on every play() rather than once — the caption is a dozen
 *     characters, the plate's geometry changes on hover, and a stale bitmap
 *     would land the glyphs in the wrong place;
 *   - a play() cancels any sweep still running, so quick enter/leave flicks
 *     always converge on the latest state instead of queueing;
 *   - steps are smaller and faster: the glyphs are ~13px tall, so the
 *     headline's 28px cells would blot the whole line, and hover feedback
 *     has to land inside the plate's own 0.38s grow.
 */

const STEPS = [16, 11, 7, 4, 2];
const FIRST_MS = 110;
const STEP_MS = 55;
/** Sharp frame held before the real text takes over — same trick as the
    headline: the canvas and the DOM text are identical pixels by then. */
const SETTLE_MS = 70;

export interface PixelCaptionHover {
  /** Sweep the caption through blocks into `color`. Cancels a running sweep. */
  play: (color: string) => void;
  /** Remove any overlay and restore the text immediately. */
  dispose: () => void;
}

export function createPixelCaptionHover(
  container: HTMLElement,
  lines: HTMLElement[],
): PixelCaptionHover {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let canvas: HTMLCanvasElement | null = null;

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    canvas?.remove();
    canvas = null;
    for (const l of lines) l.style.visibility = "";
  };

  const play = (color: string) => {
    cancel();
    const box = container.getBoundingClientRect();
    if (!box.width || !box.height) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(1, Math.round(box.width * dpr));
    const H = Math.max(1, Math.round(box.height * dpr));

    // ── Rasterise the caption, glyph by glyph, where the DOM put them ──
    // Split into characters purely to MEASURE them; the spans are temporary
    // and the markup is restored as soon as the positions are read.
    const originals = lines.map((l) => l.innerHTML);
    const measured: { ch: string; x: number; y: number; font: string }[] = [];
    for (const line of lines) {
      const text = line.textContent ?? "";
      const cs = getComputedStyle(line);
      // The caption renders uppercase via text-transform; the canvas has to
      // draw the transformed glyphs or it paints different letters than the
      // ones it measured. (The headline had no transform, so the original
      // never needed this.)
      const upper = cs.textTransform === "uppercase";
      const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} / ${cs.lineHeight} ${cs.fontFamily}`;
      line.textContent = "";
      const spans: HTMLElement[] = [];
      for (const ch of text) {
        if (ch === " ") {
          line.appendChild(document.createTextNode(" "));
          continue;
        }
        const span = document.createElement("span");
        span.textContent = ch;
        span.style.display = "inline-block";
        line.appendChild(span);
        spans.push(span);
      }
      for (const span of spans) {
        const r = span.getBoundingClientRect();
        const raw = span.textContent ?? "";
        measured.push({
          ch: upper ? raw.toUpperCase() : raw,
          x: (r.left - box.left) * dpr,
          y: (r.bottom - box.top) * dpr,
          font,
        });
      }
    }
    lines.forEach((l, i) => (l.innerHTML = originals[i]));
    if (!measured.length) return;

    const source = document.createElement("canvas");
    source.width = W;
    source.height = H;
    const sctx = source.getContext("2d");
    if (!sctx) return;
    sctx.scale(dpr, dpr);
    sctx.fillStyle = color;
    sctx.textBaseline = "alphabetic";
    for (const g of measured) {
      sctx.font = g.font;
      const m = sctx.measureText(g.ch);
      const descent = m.actualBoundingBoxDescent || 0;
      sctx.fillText(g.ch, g.x / dpr, g.y / dpr - descent);
    }

    // ── Overlay ──
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    cv.setAttribute("aria-hidden", "true");
    Object.assign(cv.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: `${box.width}px`,
      height: `${box.height}px`,
      pointerEvents: "none",
      zIndex: "1",
    } as Partial<CSSStyleDeclaration>);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    container.appendChild(cv);
    canvas = cv;
    for (const l of lines) l.style.visibility = "hidden";

    const off = document.createElement("canvas");
    const octx = off.getContext("2d");
    const draw = (cell: number) => {
      if (!octx) return;
      ctx.clearRect(0, 0, W, H);
      const c = cell * dpr;
      const w = Math.max(1, Math.round(W / c));
      const h = Math.max(1, Math.round(H / c));
      off.width = w;
      off.height = h;
      octx.clearRect(0, 0, w, h);
      octx.imageSmoothingEnabled = true;
      octx.drawImage(source, 0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, w, h, 0, 0, W, H);
    };

    let i = 0;
    draw(STEPS[0]);
    const step = () => {
      i += 1;
      if (i >= STEPS.length) {
        // Sharp frame, one beat, then hand back to the (recoloured) DOM text.
        ctx.clearRect(0, 0, W, H);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(source, 0, 0);
        timer = setTimeout(cancel, SETTLE_MS);
        return;
      }
      draw(STEPS[i]);
      timer = setTimeout(step, STEP_MS);
    };
    timer = setTimeout(step, FIRST_MS);
  };

  return { play, dispose: cancel };
}
