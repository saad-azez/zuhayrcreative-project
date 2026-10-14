"use client";

import { useEffect } from "react";
import { rasterise } from "./marbleRaster";

/**
 * The glitch appear — the paragraph section's pixelated arrival, for the rest
 * of the site's words and numbers (client, 15 Oct: "let's add the glitch
 * appear effect we have for the text and icons in the paragraph section to
 * the rest of the site's texts and numbers").
 *
 * The same look as that section's (VerticalGallery/pixelTextReveal.ts): the
 * text arrives as square blocks, cut across the letters, in the greys that
 * averaging glyph and gap gives, and sharpens in five steps to type. The cell
 * sizes and timings are that sweep's, as fractions of the line.
 *
 * The same way, too: a picture in a canvas, made coarse and blown back up
 * with smoothing off. That one draws a headline it knows in advance; this
 * draws whatever block it is given, with the marble seam's rasteriser, which
 * draws text where the browser laid it, in its own font and colour. And it
 * draws it again at every step, because many of these blocks are moving
 * when they arrive (the impact section's counters spin as they come in):
 * each step shows them as they are by then, so they keep moving through the
 * blocks and hand over to themselves. While the picture is up the element is
 * clipped away, not hidden, so that it can still be drawn.
 *
 * (An SVG filter on the live element was tried first and does the same in
 * one line, but Safari draws that filter at some sizes and not others, and
 * at others drops the element altogether.)
 *
 * ── Which, and when ──
 * Each block of text in the page and the footer: from every piece of text,
 * the largest wrapper around it that is still only words (no pictures, no
 * canvases, short), so a number and its label arrive together and a
 * paragraph arrives whole. Not the hero, which has its own entrance, and not
 * the paragraph section, which has this already.
 *
 * Hidden from the start, and shown by the effect the first time it is on the
 * screen and not faded out by its own section (the services panels stand on
 * one another, faded, and each should arrive as it comes forward). What is on
 * the first screen of a page waits for the loader's curtain to lift. Nothing
 * can be left hidden: whatever has been on the screen for a few seconds is
 * shown, effect or not.
 *
 * Reduced motion gets the words as they are, with no effect.
 */

/** Cell size per step, as a fraction of one line's height: pixelTextReveal's. */
const STEP_RATIOS = [0.406, 0.29, 0.188, 0.116, 0.058];
const MIN_CELL = 2;
/** The coarse end is held longest, then a step every STEP_MS. */
const FIRST_MS = 240;
const STEP_MS = 90;
/** The sharp picture is held this long before the element takes over. */
const SETTLE_MS = 70;
/** Blocks arriving together go one after another, this far apart. */
const STAGGER_MS = 70;
/** On the screen this long and still hidden: shown, whatever its section says. */
const RELEASE_MS = 2500;

/** A wrapper is still "only words" up to these sizes. */
const MAX_CHARS = 420;
const MAX_ELEMENTS = 140;
const MAX_HEIGHT_SCREENS = 0.6;

/** Not touched, nor anything in them. */
const EXCLUDE = [
  "#hero-banner",
  ".sr-only",
  "[data-glitch-canvas]",
  '[data-section="gallery"]',
  "[data-no-glitch]",
  "nav",
  "svg",
  "canvas",
  "video",
  "input",
  "textarea",
  "select",
  "script",
  "style",
  "noscript",
].join(",");
/** A wrapper holding any of these is not only words. */
const NOT_WORDS = "img,picture,svg,canvas,video,iframe,input,textarea,select,[data-no-glitch]";


export default function GlitchReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const roots = () => [...document.querySelectorAll<HTMLElement>("main, footer")];
    if (!roots().length) return;

    const style = document.createElement("style");
    style.textContent =
      `[data-glitch="pending"],[data-glitch="queued"]{visibility:hidden!important}` +
      `[data-glitch="playing"]{clip-path:inset(0 0 100% 0)!important}`;
    document.head.appendChild(style);

    // ── Finding the blocks ──
    const seen = new WeakSet<Element>();
    // Within one pass the same wrappers are asked about again and again (every
    // word in a paragraph climbs through them): answered once each.
    let memo = new Map<Element, boolean>();
    const isWords = (el: Element) => {
      let v = memo.get(el);
      if (v === undefined) {
        v = wordsOnly(el);
        memo.set(el, v);
      }
      return v;
    };
    const wordsOnly = (el: Element) => {
      if (el.matches("main, footer, section, body")) return false;
      const text = el.textContent?.trim() ?? "";
      if (!text || text.length > MAX_CHARS) return false;
      if (el.querySelector(NOT_WORDS)) return false;
      if (el.getElementsByTagName("*").length > MAX_ELEMENTS) return false;
      const r = el.getBoundingClientRect();
      if (r.height > window.innerHeight * MAX_HEIGHT_SCREENS) return false;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" || cs.transformStyle === "preserve-3d") return false;
      return true;
    };
    const blockFor = (node: Text): HTMLElement | null => {
      let el = node.parentElement;
      if (!el || el.closest(EXCLUDE)) return null;
      if (!isWords(el)) return null;
      // Up while the wrapper is still only words.
      for (let up = el.parentElement; up && isWords(up); up = up.parentElement) el = up;
      return el as HTMLElement;
    };

    const onScreen = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) inView.set(e.target as HTMLElement, inView.get(e.target as HTMLElement) ?? performance.now());
          else inView.delete(e.target as HTMLElement);
        }
        tick();
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    const inView = new Map<HTMLElement, number>();

    let covered = !(window as Window & { __appUncovered?: boolean }).__appUncovered;
    const mark = (scope: Element) => {
      memo = new Map();
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      const found = new Set<HTMLElement>();
      let n: Node | null;
      while ((n = walker.nextNode())) {
        if (!(n as Text).data.trim()) continue;
        const parent = (n as Text).parentElement;
        if (!parent || seen.has(parent) || parent.closest("[data-glitch]")) continue;
        const block = blockFor(n as Text);
        if (block) found.add(block);
      }
      for (const el of found) {
        if (seen.has(el) || el.closest("[data-glitch]")) continue;
        // Anything already marked inside it is part of it now.
        el.querySelectorAll("[data-glitch]").forEach((inner) => {
          io.unobserve(inner);
          inView.delete(inner as HTMLElement);
          inner.removeAttribute("data-glitch");
        });
        seen.add(el);
        // On the screen and already shown: left as it is.
        if (!covered && onScreen(el)) continue;
        el.setAttribute("data-glitch", "pending");
        io.observe(el);
      }
    };

    // ── Playing ──
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };
    const play = (el: HTMLElement, delay: number) => {
      io.unobserve(el);
      inView.delete(el);
      el.setAttribute("data-glitch", "queued");
      later(() => run(el), delay);
    };

    /** The sweep, on one element: its picture, coarse to sharp, then itself. */
    const run = (el: HTMLElement) => {
      const parent = el.parentNode;
      if (!el.isConnected || !parent) return;
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2 || 20;
      const cells = STEP_RATIOS.map((r) => Math.max(MIN_CELL, Math.round(r * lh)));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Beside it, so it moves with it (same parent, same clip, same fade).
      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      canvas.setAttribute("data-glitch-canvas", "");
      Object.assign(canvas.style, {
        position: "absolute",
        left: "0px",
        top: "0px",
        pointerEvents: "none",
        margin: "0",
      });
      const ctx = canvas.getContext("2d");
      const pic = { canvas: document.createElement("canvas"), ctx: null as unknown as CanvasRenderingContext2D };
      const diff = { canvas: document.createElement("canvas"), ctx: null as unknown as CanvasRenderingContext2D };
      pic.ctx = pic.canvas.getContext("2d")!;
      diff.ctx = diff.canvas.getContext("2d")!;
      const small = document.createElement("canvas");
      const sctx = small.getContext("2d");
      if (!ctx || !pic.ctx || !sctx) {
        el.removeAttribute("data-glitch");
        return;
      }
      el.after(canvas);
      el.setAttribute("data-glitch", "playing");

      let W = 0;
      let H = 0;
      /** The element, drawn as it is now, with the canvas laid over where it is. */
      const take = () => {
        const r = el.getBoundingClientRect();
        canvas.style.left = "0px";
        canvas.style.top = "0px";
        const at = canvas.getBoundingClientRect();
        canvas.style.left = `${r.left - at.left}px`;
        canvas.style.top = `${r.top - at.top}px`;
        canvas.style.width = `${r.width}px`;
        canvas.style.height = `${r.height}px`;
        const w = Math.max(1, Math.round(r.width * dpr));
        const h = Math.max(1, Math.round(r.height * dpr));
        if (w !== W || h !== H) {
          W = w;
          H = h;
          for (const c of [canvas, pic.canvas, diff.canvas]) {
            c.width = w;
            c.height = h;
          }
        }
        rasterise(pic, diff, [el], 0, dpr, window.innerWidth, window.innerHeight, true, { x: r.left, y: r.top });
      };
      const coarse = (cell: number) => {
        const c = cell * dpr;
        const w = Math.max(1, Math.round(W / c));
        const h = Math.max(1, Math.round(H / c));
        small.width = w;
        small.height = h;
        sctx.imageSmoothingEnabled = true;
        sctx.clearRect(0, 0, w, h);
        sctx.drawImage(pic.canvas, 0, 0, w, h);
        ctx.clearRect(0, 0, W, H);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(small, 0, 0, w, h, 0, 0, W, H);
      };
      const finish = () => {
        canvas.remove();
        if (el.getAttribute("data-glitch") === "playing") el.removeAttribute("data-glitch");
      };

      let i = 0;
      const step = () => {
        if (!el.isConnected) {
          canvas.remove();
          return;
        }
        try {
          take();
          if (i < cells.length) {
            coarse(cells[i]);
          } else {
            // The sharp frame for a beat, so the hand-over to the real text
            // has nothing to show (pixelTextReveal's SETTLE).
            ctx.clearRect(0, 0, W, H);
            ctx.drawImage(pic.canvas, 0, 0);
            later(finish, SETTLE_MS);
            return;
          }
        } catch {
          finish();
          return;
        }
        later(step, i === 0 ? FIRST_MS : STEP_MS);
        i += 1;
      };
      step();
    };

    /** Shown with no effect (on the screen too long, or past). */
    const release = (el: HTMLElement) => {
      io.unobserve(el);
      inView.delete(el);
      el.removeAttribute("data-glitch");
    };

    /** How visible its own page makes it: its and its ancestors' opacity. */
    const opacityOf = (el: HTMLElement) => {
      let o = 1;
      for (let e: HTMLElement | null = el; e && e !== document.body; e = e.parentElement) {
        o *= parseFloat(getComputedStyle(e).opacity) || 0;
        if (o <= 0.02) break;
      }
      return o;
    };

    let polling = 0;
    const tick = () => {
      if (covered || !inView.size) return;
      const now = performance.now();
      let k = 0;
      for (const [el, since] of [...inView]) {
        if (!el.isConnected) {
          inView.delete(el);
          continue;
        }
        if (opacityOf(el) > 0.02) play(el, k++ * STAGGER_MS);
        else if (now - since > RELEASE_MS) release(el);
      }
      // Some are on the screen but faded out by their section: look again soon.
      if (inView.size && !polling) {
        polling = window.setTimeout(() => {
          polling = 0;
          tick();
        }, 120);
      }
    };

    const onUncovered = () => {
      covered = false;
      tick();
    };
    window.addEventListener("app:uncovered", onUncovered);

    // ── What arrives later (a section hydrated, a list filled) ──
    let pending: Element[] = [];
    let raf = 0;
    const mo = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => n.nodeType === 1 && pending.push(n as Element));
      if (pending.length && !raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          const batch = pending;
          pending = [];
          const rs = roots();
          for (const el of batch) {
            if (el.isConnected && rs.some((r) => r.contains(el))) mark(el);
          }
          tick();
        });
      }
    });

    roots().forEach(mark);
    mo.observe(document.body, { childList: true, subtree: true });
    tick();

    return () => {
      window.removeEventListener("app:uncovered", onUncovered);
      mo.disconnect();
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      if (polling) clearTimeout(polling);
      timers.forEach(clearTimeout);
      document.querySelectorAll("[data-glitch]").forEach((el) => el.removeAttribute("data-glitch"));
      document.querySelectorAll("[data-glitch-canvas]").forEach((c) => c.remove());
      style.remove();
    };
  }, []);

  return null;
}
