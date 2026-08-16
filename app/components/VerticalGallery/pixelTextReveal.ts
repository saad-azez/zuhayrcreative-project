"use client";

/**
 * Pixelated reveal for the gallery's pinned headline.
 *
 * The words arrive as chunky square blocks that sharpen into type, matching the
 * reference: uniform cells that cut ACROSS the letterforms in a reduced set of
 * greys, with no regard for where one glyph ends and the next begins.
 *
 * That last part is why this rasterises. The first attempt revealed the headline
 * character by character — cells were letters, so blocks always aligned to glyph
 * boundaries and the effect read as a staggered fade rather than as pixelation.
 * Real pixelation needs a bitmap, so the text is DRAWN into a canvas and the
 * canvas is what gets downsampled and blown back up with smoothing off (the same
 * technique as usePixelReveal, which does this for the process icons).
 *
 * Positions come from the DOM rather than from re-implementing text layout in
 * canvas: each character is measured where the browser actually put it and drawn
 * at that exact point. Reconstructing centred, letter-spaced, clamp-sized lines
 * by hand would drift out of register with the real text underneath.
 *
 * The greys are free: the glyphs are drawn white on transparent, so averaging a
 * cell that is part glyph and part gap yields partial alpha — which reads as a
 * grey block over the dark page. No palette needed.
 *
 * ── Timed, with a deadline ────────────────────────────────────────────────
 * The sweep runs on its own clock — it is a fixed piece of motion, not something
 * to be scrubbed — but it must be OFF SCREEN by the time the headline goes
 * sticky and the highlight takes over. `finishNow` is that deadline: the caller
 * fires it the instant the pin engages, and the sweep snaps to its sharp frame
 * and hands over rather than bleeding into the highlight.
 */

import gsap from "gsap";

/**
 * Cell size in px, coarse to fine. Discrete on purpose: interpolating cell size
 * would smear the blocks into a blur, and the blockiness IS the effect.
 */
const STEPS = [28, 20, 13, 8, 4];
/** The coarse end is held longest so the big blocks actually register. */
const FIRST_MS = 240;
const STEP_MS = 90;
/**
 * The sweep's last frame is the type drawn SHARP — not a blocky step — and it is
 * held for this long before the real text takes over. That is what makes the
 * hand-off invisible: the canvas and the DOM text are the same pixels at that
 * moment, so the swap has nothing to show. Swapping straight out of a 4px-block
 * frame popped.
 */
const SETTLE_MS = 90;

export interface PixelTextReveal {
  /** Start the sweep. */
  play: () => void;
  /** Deadline: snap to sharp and hand over now. Safe to call at any point. */
  finishNow: () => void;
  /** True once the type is back on screen. */
  isDone: () => boolean;
  /** Puts the headline back exactly as it was found. */
  revert: () => void;
}

export function createPixelTextReveal(
  container: HTMLElement,
  lines: HTMLElement[],
  onHandOff: () => void = () => {},
): PixelTextReveal | null {
  if (!lines.length) return null;
  if (typeof window === "undefined") return null;

  const box = container.getBoundingClientRect();
  if (!box.width || !box.height) return null;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.max(1, Math.round(box.width * dpr));
  const H = Math.max(1, Math.round(box.height * dpr));

  // Full-resolution bitmap of the type, drawn once and reused by every step.
  const source = document.createElement("canvas");
  source.width = W;
  source.height = H;
  const sctx = source.getContext("2d");
  if (!sctx) return null;

  // Split into characters purely to MEASURE them; the spans are temporary and
  // are torn down as soon as the bitmap is drawn.
  const originals = lines.map((l) => l.innerHTML);
  const measured: { ch: string; x: number; y: number; font: string }[] = [];

  for (const line of lines) {
    const text = line.textContent ?? "";
    const cs = getComputedStyle(line);
    // Canvas wants the shorthand; letter-spacing is already baked into the
    // per-character positions we measure, so it must NOT be applied again here.
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
      measured.push({
        ch: span.textContent ?? "",
        x: (r.left - box.left) * dpr,
        // Bottom of the glyph box; the descent is taken off below so the glyph
        // lands on the baseline the DOM gave it.
        y: (r.bottom - box.top) * dpr,
        font,
      });
    }
  }

  // Restore the markup immediately — from here on the canvas is the picture.
  lines.forEach((l, i) => (l.innerHTML = originals[i]));

  if (!measured.length) return null;

  sctx.scale(dpr, dpr);
  sctx.fillStyle = "#ffffff";
  sctx.textBaseline = "alphabetic";
  for (const g of measured) {
    sctx.font = g.font;
    const m = sctx.measureText(g.ch);
    const descent = m.actualBoundingBoxDescent || 0;
    sctx.fillText(g.ch, g.x / dpr, g.y / dpr - descent);
  }
  sctx.setTransform(1, 0, 0, 1, 0, 0);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: `${box.width}px`,
    height: `${box.height}px`,
    pointerEvents: "none",
    zIndex: "1",
  } as CSSStyleDeclaration);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }
  container.appendChild(canvas);

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

  const drawSharp = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, 0, 0);
  };

  // `visibility` rather than opacity: the highlight animates background-size on
  // these lines and reads their computed colour, and an inline opacity would sit
  // in its way.
  gsap.set(lines, { visibility: "hidden" });

  let done = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let i = 0;
  draw(STEPS[0]);

  /** Sharp frame, then hand the picture to the real text. */
  const handOff = () => {
    if (done) return;
    done = true;
    if (timer) clearTimeout(timer);
    timer = null;
    drawSharp();
    // One beat with the sharp canvas up, so the swap below changes nothing on
    // screen.
    timer = setTimeout(() => {
      timer = null;
      canvas.style.display = "none";
      gsap.set(lines, { visibility: "" });
      onHandOff();
    }, SETTLE_MS);
  };

  const step = () => {
    i += 1;
    if (i >= STEPS.length) {
      handOff();
      return;
    }
    draw(STEPS[i]);
    timer = setTimeout(step, STEP_MS);
  };

  return {
    play: () => {
      if (done || timer) return;
      timer = setTimeout(step, FIRST_MS);
    },
    finishNow: handOff,
    isDone: () => done,
    revert: () => {
      if (timer) clearTimeout(timer);
      timer = null;
      done = true;
      canvas.remove();
      gsap.set(lines, { visibility: "" });
    },
  };
}
