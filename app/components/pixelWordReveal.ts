"use client";

/**
 * Word-by-word pixel reveal, for a paragraph that arrives when you scroll to
 * it.
 *
 * Same language as the work strip's caption sweep (pixelCaptionHover) and the
 * gallery headline before it: the type is rasterised into a canvas, drawn as
 * chunky blocks, and stepped coarse → fine until it lands sharp, at which
 * point the real DOM text takes over and the swap shows nothing. The
 * difference is the unit. Those two pixelate a whole line at once; this one
 * owns each WORD, and starts them one after another, so the sentence resolves
 * left to right like something being typed out of static.
 *
 * ── Scroll is the trigger, not the clock ──
 * It is played once, on arrival, and then runs on its own timeline. Nothing
 * here reads the scroll position: scrubbing a reveal like this to scroll means
 * it runs backwards when the reader nudges upward, and stalls half-resolved if
 * they stop — which is exactly what a reveal must not do.
 *
 * ── How a word is drawn ──
 * The whole paragraph is rasterised ONCE into a source canvas, at the
 * positions the browser laid the words out in. Each word then blits its own
 * rectangle of that source through a downscale/upscale pass to get its blocks,
 * so wrapping, kerning and the line breaks are the browser's, not ours — the
 * final sharp frame lands on exactly the pixels the DOM text will show.
 *
 * The baseline for each word comes from a zero-size inline marker parked at
 * the end of it: its top edge IS the baseline, whatever the line-height and
 * half-leading work out to. Deriving it from the word's own box instead is
 * where this kind of effect usually goes wrong — a box is the line's height,
 * not the glyphs'.
 */

/** Block sizes a word steps through, coarse to fine, in CSS px. */
const STEPS = [14, 9, 5, 3, 2];
/** How long each block size holds. */
const STEP_MS = 42;
/** Gap between one word starting and the next. */
const WORD_STAGGER_MS = 55;
/** Sharp frame held before the DOM text takes the word back. */
const SETTLE_MS = 60;
/** Slack around a word's box, so descenders and italics are never clipped. */
const PAD_PX = 6;

export interface PixelWordReveal {
  /** Run it. Ignored if it has already been run or is running. */
  play: () => void;
  /** Stop, drop the canvas and show the text. */
  dispose: () => void;
}

interface Word {
  el: HTMLElement;
  /** Box in container space, CSS px, already padded. */
  x: number;
  y: number;
  w: number;
  h: number;
  done: boolean;
}

/**
 * `container` must be the element holding the text and nothing else; it is
 * given `position: relative` if it has none, because the canvas sits in it.
 */
export function createPixelWordReveal(container: HTMLElement): PixelWordReveal {
  let raf = 0;
  let canvas: HTMLCanvasElement | null = null;
  let words: Word[] = [];
  let started = false;
  let finished = false;

  /** Split the text into inline-block word spans, once. */
  const splitWords = (): HTMLElement[] => {
    const text = container.textContent ?? "";
    if (!text.trim()) return [];
    container.textContent = "";
    const out: HTMLElement[] = [];
    // Split on whitespace but keep the gaps, so the spacing is the browser's.
    for (const part of text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        container.appendChild(document.createTextNode(part));
        continue;
      }
      const span = document.createElement("span");
      span.textContent = part;
      // inline-block gives the word a box to measure. It also means a word is
      // never broken across lines, which is what we want anyway.
      span.style.display = "inline-block";
      span.style.willChange = "visibility";
      container.appendChild(span);
      out.push(span);
    }
    return out;
  };

  const restore = () => {
    for (const w of words) w.el.style.visibility = "";
  };

  const cancel = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    canvas?.remove();
    canvas = null;
    restore();
  };

  const play = () => {
    if (started || finished) return;
    started = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finished = true;
      return;
    }

    const spans = splitWords();
    if (spans.length === 0) {
      finished = true;
      return;
    }

    const box = container.getBoundingClientRect();
    if (!box.width || !box.height) {
      // Not laid out (display:none, a collapsed parent) — leave the text be.
      finished = true;
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(1, Math.round(box.width * dpr));
    const H = Math.max(1, Math.round(box.height * dpr));

    const cs = getComputedStyle(container);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} / ${cs.lineHeight} ${cs.fontFamily}`;
    const colour = cs.color;
    const upper = cs.textTransform === "uppercase";

    // ── Measure every word, and its baseline ──
    // The marker is a zero-size inline box sitting on the baseline; its top
    // edge is the baseline, whatever the leading is.
    const measured: Array<{ el: HTMLElement; text: string; x: number; base: number }> = [];
    for (const el of spans) {
      const marker = document.createElement("i");
      marker.style.display = "inline-block";
      marker.style.width = "0";
      marker.style.height = "0";
      marker.style.verticalAlign = "baseline";
      el.appendChild(marker);
      const r = el.getBoundingClientRect();
      const base = marker.getBoundingClientRect().top;
      marker.remove();
      const raw = el.textContent ?? "";
      measured.push({
        el,
        text: upper ? raw.toUpperCase() : raw,
        x: r.left - box.left,
        base: base - box.top,
      });
    }

    // ── The sharp source, drawn where the browser put the words ──
    const source = document.createElement("canvas");
    source.width = W;
    source.height = H;
    const sctx = source.getContext("2d");
    if (!sctx) {
      finished = true;
      return;
    }
    sctx.scale(dpr, dpr);
    sctx.font = font;
    sctx.fillStyle = colour;
    sctx.textBaseline = "alphabetic";
    for (const m of measured) sctx.fillText(m.text, m.x, m.base);

    // ── The overlay ──
    if (cs.position === "static") container.style.position = "relative";
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
    if (!ctx) {
      finished = true;
      return;
    }
    container.appendChild(cv);
    canvas = cv;

    words = measured.map((m) => {
      const r = m.el.getBoundingClientRect();
      m.el.style.visibility = "hidden";
      return {
        el: m.el,
        x: Math.max(0, r.left - box.left - PAD_PX),
        y: Math.max(0, r.top - box.top - PAD_PX),
        w: Math.min(box.width, r.width + PAD_PX * 2),
        h: Math.min(box.height, r.height + PAD_PX * 2),
        done: false,
      };
    });

    // One scratch canvas for every downscale, reused.
    const off = document.createElement("canvas");
    const octx = off.getContext("2d");

    const RUN_MS = STEPS.length * STEP_MS;
    const t0 = performance.now();

    /** Blit one word's rectangle of the source at a given block size. */
    const drawWord = (word: Word, cell: number) => {
      if (!octx) return;
      const sx = Math.round(word.x * dpr);
      const sy = Math.round(word.y * dpr);
      const sw = Math.max(1, Math.round(word.w * dpr));
      const sh = Math.max(1, Math.round(word.h * dpr));
      if (cell <= 1) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(source, sx, sy, sw, sh, sx, sy, sw, sh);
        return;
      }
      const c = cell * dpr;
      const w = Math.max(1, Math.round(sw / c));
      const h = Math.max(1, Math.round(sh / c));
      off.width = w;
      off.height = h;
      octx.clearRect(0, 0, w, h);
      octx.imageSmoothingEnabled = true;
      octx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, w, h, sx, sy, sw, sh);
    };

    const frame = (now: number) => {
      ctx.clearRect(0, 0, W, H);
      let allDone = true;
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (word.done) continue;
        const t = now - t0 - i * WORD_STAGGER_MS;
        if (t < 0) {
          // Not its turn yet: nothing drawn, and its DOM text stays hidden.
          allDone = false;
          continue;
        }
        if (t >= RUN_MS + SETTLE_MS) {
          // Sharp for a beat, then the DOM text takes it back — by which
          // point the canvas and the text are the same pixels, so the
          // handover shows nothing.
          word.done = true;
          word.el.style.visibility = "";
          word.el.style.willChange = "";
          continue;
        }
        allDone = false;
        const step = Math.min(STEPS.length - 1, Math.floor(t / STEP_MS));
        drawWord(word, t >= RUN_MS ? 1 : STEPS[step]);
      }
      if (allDone) {
        finished = true;
        cancel();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  };

  return {
    play,
    dispose: () => {
      finished = true;
      cancel();
    },
  };
}
