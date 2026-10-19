/**
 * Draws a screen of the live page into a 2D canvas, for the marble seam
 * (MarbleSeam.tsx), which needs the page as a picture a shader can tear.
 *
 * A browser will not hand over its own rendering of HTML, so this draws the
 * page again itself, from what the DOM reports: where each thing is and how
 * it is styled. It is a small, particular rasteriser, not a general one. It
 * knows what the two screens either side of that seam are made of:
 *
 *   - canvases (the services section's tunnel) and images, drawn as they are,
 *     but for one marked `data-marble-live`, which the seam reads itself;
 *   - text, a character at a time at the place the browser put it, in its
 *     own font, colour and opacity, gradient text (`background-clip: text`)
 *     included;
 *   - SVG line work (rect, line, circle, path), through the element's own
 *     transform;
 *   - plain boxes: a background colour, a border, rounded corners;
 *   - clipping by `overflow`, opacity inherited down the tree, and stacking
 *     by z-index among siblings.
 *
 * It draws the screen's CONTENTS, over nothing: the page's background scene
 * is not in the picture (the seam lays the contents over the live scene
 * itself). And what is set to `mix-blend-mode: difference` goes into a
 * second picture of its own, because a difference needs the thing it differs
 * from, which is that background: the seam's shader takes it there.
 *
 * What it does not draw: backdrop filters (glass), shadows, masks, CSS
 * filters, and transforms beyond a move or a scale. The seam shows these
 * pictures torn and in motion, and hands over to the real page through a
 * short cross-fade, so the differences are a glass pill a little plainer for
 * a moment, not a wrong page.
 *
 * `shift` moves the page: the picture is the page as it would be scrolled
 * `shift` px further up than it is now, which is how a screen that is not
 * the one on screen is drawn.
 */

export interface RasterTarget {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

/** Pictures of the words alone, and of the difference-blended ones: see rasterise. */
export interface WordTargets {
  target: RasterTarget;
  diff: RasterTarget;
}

interface Pass {
  /** Draw text? The marble seam leaves it out: see rasterise. */
  text: boolean;
  /** Where the element being walked is drawn: the picture, or the difference picture. */
  ctx: CanvasRenderingContext2D;
  diff: CanvasRenderingContext2D;
  /** Where its words go instead, when they have pictures of their own. */
  words: { ctx: CanvasRenderingContext2D; diff: CanvasRenderingContext2D } | null;
  /** The element this walk started from. */
  root: Element | null;
  shift: number;
  vw: number;
  vh: number;
}

const clear = (c: string) =>
  !c || c === "transparent" || /rgba\([^)]*,\s*0\)$/.test(c) || /\/\s*0\)$/.test(c);

const px = (v: string) => parseFloat(v) || 0;

/** Font metrics, per font string: how far the baseline is down a line of that font. */
const baselines = new Map<string, number>();
function baselineShare(ctx: CanvasRenderingContext2D, font: string) {
  let share = baselines.get(font);
  if (share === undefined) {
    ctx.font = font;
    const m = ctx.measureText("Hxg");
    const asc = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
    const desc = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
    share = asc + desc > 0 ? asc / (asc + desc) : 0.8;
    baselines.set(font, share);
  }
  return share;
}

/** A CSS `linear-gradient(...)` as a canvas gradient across a box, or null. */
function linearGradient(
  ctx: CanvasRenderingContext2D,
  css: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const open = css.indexOf("linear-gradient(");
  if (open < 0) return null;
  const body = css.slice(open + 16, css.lastIndexOf(")"));
  // Split on the commas that are not inside a colour function.
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  if (parts.length < 2) return null;
  let angle = 180;
  const first = parts[0];
  if (/deg$/.test(first)) {
    angle = parseFloat(first);
    parts.shift();
  } else if (first.startsWith("to ")) {
    angle = { "to top": 0, "to right": 90, "to bottom": 180, "to left": 270 }[first] ?? 180;
    parts.shift();
  }
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const g = ctx.createLinearGradient(
    cx - (dx * len) / 2,
    cy - (dy * len) / 2,
    cx + (dx * len) / 2,
    cy + (dy * len) / 2,
  );
  parts.forEach((stop, i) => {
    const m = stop.match(/^(.*?)(?:\s+(-?[\d.]+)%)?$/);
    const color = (m?.[1] ?? stop).trim();
    const at = m?.[2] !== undefined ? parseFloat(m[2]) / 100 : i / (parts.length - 1);
    try {
      g.addColorStop(Math.min(1, Math.max(0, at)), color);
    } catch {
      /* a colour the canvas will not take: that stop is skipped */
    }
  });
  return g;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (rr > 0 && ctx.roundRect) ctx.roundRect(x, y, w, h, rr);
  else ctx.rect(x, y, w, h);
}

const range = typeof document !== "undefined" ? document.createRange() : null;

/** One text node, a character at a time, where the browser laid each out. */
function drawText(
  pass: Pass,
  ctx: CanvasRenderingContext2D,
  node: Text,
  cs: CSSStyleDeclaration,
  alpha: number,
  box: DOMRect,
) {
  const { shift, vh } = pass;
  if (!range) return;
  let text = node.data;
  if (!text.trim()) return;
  const tt = cs.textTransform;
  if (tt === "uppercase") text = text.toUpperCase();
  else if (tt === "lowercase") text = text.toLowerCase();
  const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const share = baselineShare(ctx, font);
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // What the glyphs are filled with: the text colour, or, for gradient text,
  // the element's background drawn through them.
  let fill: string | CanvasGradient = cs.color;
  const fillColor = cs.getPropertyValue("-webkit-text-fill-color");
  const clipText =
    cs.getPropertyValue("-webkit-background-clip") === "text" || cs.backgroundClip === "text";
  if (clipText && cs.backgroundImage !== "none") {
    fill =
      linearGradient(ctx, cs.backgroundImage, box.left, box.top + shift, box.width, box.height) ??
      "#ffffff";
  } else if (fillColor && !clear(fillColor)) {
    fill = fillColor;
  } else if (clear(cs.color)) {
    return;
  }
  ctx.fillStyle = fill;
  ctx.globalAlpha = alpha;

  const n = node.length;
  for (let i = 0; i < n; i++) {
    const ch = text[i];
    if (ch === " " || ch === "\n" || ch === "\t") continue;
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const r = range.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const top = r.top + shift;
    if (top > vh || top + r.height < 0) continue;
    ctx.fillText(ch, r.left, top + r.height * share);
  }
}

/** An SVG shape, through its own transform to the screen. */
function drawShape(pass: Pass, el: SVGGraphicsElement, cs: CSSStyleDeclaration, alpha: number) {
  const { ctx, shift } = pass;
  const m = el.getScreenCTM();
  if (!m) return;
  const tag = el.tagName.toLowerCase();
  const num = (name: string) => parseFloat(el.getAttribute(name) ?? "0") || 0;
  let path: Path2D | null = null;
  if (tag === "path") {
    const d = el.getAttribute("d");
    if (d) path = new Path2D(d);
  } else if (tag === "rect") {
    path = new Path2D();
    const rx = num("rx");
    if (rx > 0 && path.roundRect) path.roundRect(num("x"), num("y"), num("width"), num("height"), rx);
    else path.rect(num("x"), num("y"), num("width"), num("height"));
  } else if (tag === "line") {
    path = new Path2D();
    path.moveTo(num("x1"), num("y1"));
    path.lineTo(num("x2"), num("y2"));
  } else if (tag === "circle") {
    path = new Path2D();
    path.arc(num("cx"), num("cy"), num("r"), 0, Math.PI * 2);
  }
  if (!path) return;
  // Into the screen's own space, so a line's width is in CSS px whatever the
  // drawing's scale is: the services frame is a 100x100 drawing stretched
  // over the screen, with hairlines that must stay hairlines
  // (`vector-effect: non-scaling-stroke`). A stroke that does scale is
  // given the transform's mean scale.
  const onScreen = new Path2D();
  onScreen.addPath(path, new DOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f + shift]));
  const scale =
    cs.getPropertyValue("vector-effect") === "non-scaling-stroke"
      ? 1
      : Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
  if (cs.fill && cs.fill !== "none" && tag !== "line") {
    ctx.globalAlpha = alpha * (parseFloat(cs.fillOpacity) || 1);
    ctx.fillStyle = cs.fill;
    ctx.fill(onScreen);
  }
  if (cs.stroke && cs.stroke !== "none") {
    ctx.globalAlpha = alpha * (parseFloat(cs.strokeOpacity) || 1);
    ctx.strokeStyle = cs.stroke;
    ctx.lineWidth = (px(cs.strokeWidth) || 1) * scale;
    ctx.stroke(onScreen);
  }
}

/** An image or a canvas, into its box. */
function drawPicture(
  pass: Pass,
  el: HTMLImageElement | HTMLCanvasElement,
  cs: CSSStyleDeclaration,
  r: DOMRect,
  alpha: number,
) {
  const { ctx, shift } = pass;
  const natW = el instanceof HTMLImageElement ? el.naturalWidth : el.width;
  const natH = el instanceof HTMLImageElement ? el.naturalHeight : el.height;
  if (!natW || !natH) return;
  if (el instanceof HTMLImageElement && !el.complete) return;
  let x = r.left;
  let y = r.top + shift;
  let w = r.width;
  let h = r.height;
  const fit = cs.objectFit;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (fit === "contain" || fit === "cover" || fit === "scale-down") {
    const k = fit === "cover" ? Math.max(w / natW, h / natH) : Math.min(w / natW, h / natH);
    const fw = natW * k;
    const fh = natH * k;
    if (fit === "cover") {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
    }
    x += (w - fw) / 2;
    y += (h - fh) / 2;
    w = fw;
    h = fh;
  }
  try {
    ctx.drawImage(el, x, y, w, h);
  } catch {
    /* a picture that may not be drawn (cross-origin): left out */
  }
  ctx.restore();
}

function walk(pass: Pass, el: Element, alphaIn: number) {
  const { ctx, shift, vw, vh } = pass;
  // A canvas the seam reads itself, every frame (MarbleSeam's live layer).
  if (el.hasAttribute("data-marble-live")) return;
  // A glitch reveal playing (GlitchReveal): the element is clipped away, by a
  // clip-path this does not draw, and its picture stands beside it. Drawn as
  // well, it was there twice. Not when it is the element being drawn, which
  // is how GlitchReveal makes that picture.
  if (el !== pass.root && el.getAttribute("data-glitch") === "playing") return;
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") {
    // (A hidden box can hold a visible child, by CSS; nothing here does.)
    return;
  }
  const alpha = alphaIn * (parseFloat(cs.opacity) || 0);
  if (alpha < 0.01) return;
  const r = el.getBoundingClientRect();
  const top = r.top + shift;
  const clips = cs.overflowX !== "visible" || cs.overflowY !== "visible";
  // Out of the picture, and nothing of it can reach back in.
  if (clips && (top > vh || top + r.height < 0 || r.left > vw || r.right < 0)) return;
  // Far out of it in any case: a screen away is not something a child gets back from.
  if (top > vh * 2 || top + r.height < -vh) return;

  // A difference-blended element, and all it holds, goes to the other picture.
  const differs =
    (cs.mixBlendMode === "difference" || cs.mixBlendMode === "exclusion") && pass.ctx !== pass.diff;
  if (differs) {
    const main = pass.ctx;
    pass.ctx = pass.diff;
    try {
      walk(pass, el, alphaIn);
    } finally {
      pass.ctx = main;
    }
    return;
  }
  // The words' own picture for this element (its difference one, if the
  // element is in the difference picture), clipped as the element is.
  const words = pass.words ? (ctx === pass.diff ? pass.words.diff : pass.words.ctx) : null;
  const saved = clips;
  if (saved) {
    ctx.save();
    words?.save();
  }

  const tag = el.tagName.toLowerCase();
  const onScreen = r.width > 0 && r.height > 0 && top < vh && top + r.height > 0;

  if (el instanceof SVGElement) {
    if (tag !== "svg" && tag !== "g" && onScreen) {
      drawShape(pass, el as SVGGraphicsElement, cs, alpha);
    }
  } else if (onScreen) {
    // The box itself: background colour and border.
    const radius = px(cs.borderTopLeftRadius);
    const clipText =
      cs.getPropertyValue("-webkit-background-clip") === "text" || cs.backgroundClip === "text";
    if (!clipText && !clear(cs.backgroundColor)) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = cs.backgroundColor;
      roundedRect(ctx, r.left, top, r.width, r.height, radius);
      ctx.fill();
    }
    const bw = px(cs.borderTopWidth);
    if (bw > 0 && cs.borderTopStyle !== "none" && !clear(cs.borderTopColor)) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = cs.borderTopColor;
      ctx.lineWidth = bw;
      roundedRect(ctx, r.left + bw / 2, top + bw / 2, r.width - bw, r.height - bw, radius);
      ctx.stroke();
    }
    if (words && el.hasAttribute("data-glitch-canvas")) {
      // That picture is words, so it goes with the words, which are bent
      // gently; bent as a picture, it was white scribbles.
      const main = pass.ctx;
      pass.ctx = words;
      try {
        drawPicture(pass, el as HTMLCanvasElement, cs, r, alpha);
      } finally {
        pass.ctx = main;
      }
    } else if (el instanceof HTMLImageElement || el instanceof HTMLCanvasElement) {
      drawPicture(pass, el, cs, r, alpha);
    }
  }

  if (clips) {
    for (const c of words ? [ctx, words] : [ctx]) {
      c.beginPath();
      c.rect(r.left, top, r.width, r.height);
      c.clip();
    }
  }

  if (!(el instanceof HTMLCanvasElement) && !(el instanceof HTMLImageElement)) {
    // Children: text where it stands in the order, elements by z-index (a
    // positioned child with one paints over its siblings without).
    const kids: { node: ChildNode; z: number; i: number }[] = [];
    let i = 0;
    for (const node of el.childNodes) {
      let z = 0;
      if (node.nodeType === 1) {
        const k = getComputedStyle(node as Element);
        if (k.position !== "static" && k.zIndex !== "auto") z = parseInt(k.zIndex, 10) || 0;
      }
      kids.push({ node, z, i: i++ });
    }
    kids.sort((a, b) => a.z - b.z || a.i - b.i);
    for (const { node } of kids) {
      if (node.nodeType === 3) {
        if (words) drawText(pass, words, node as Text, cs, alpha, r);
        else if (pass.text) drawText(pass, ctx, node as Text, cs, alpha, r);
      }
      else if (node.nodeType === 1) walk(pass, node as Element, alpha);
    }
  }

  if (saved) {
    ctx.restore();
    words?.restore();
  }
  ctx.globalAlpha = 1;
  if (words) words.globalAlpha = 1;
}

/**
 * Draws `roots`, as they would stand `shift` px further up the screen than
 * they do, into `target`, and their difference-blended parts into `diff`;
 * both start clear. Sizes are CSS px; the canvases are `dpr` times that.
 *
 * `text: false` leaves every word out, and the marble seam asks for that.
 * What it draws from these pictures is bent, and a bent word is an unreadable
 * one; and a word drawn here at all is a second copy of one the page is
 * already showing, a few pixels from it whenever the page has moved since
 * the picture was taken. The seam bends the page's canvases, pictures and
 * line work; its words stay the page's own, where they are.
 *
 * Given `WordTargets` instead, the words are drawn, but into pictures of their
 * own (and the difference-blended ones into the second), in the same walk.
 * That is for a band that covers a section's words rather than showing them
 * twice: it bends them apart from the rest, and less (MarbleSeam's `onto`).
 */
export function rasterise(
  target: RasterTarget,
  diff: RasterTarget,
  roots: Element[],
  shift: number,
  dpr: number,
  vw: number,
  vh: number,
  text: boolean | WordTargets = true,
  /** The screen point drawn at the canvas's top left, for a picture of one element (GlitchReveal). */
  origin = { x: 0, y: 0 },
) {
  const wordTargets = typeof text === "object" ? [text.target, text.diff] : [];
  for (const { canvas, ctx } of [target, diff, ...wordTargets]) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, -origin.x * dpr, -origin.y * dpr);
  }
  const words = typeof text === "object" ? { ctx: text.target.ctx, diff: text.diff.ctx } : null;
  const pass: Pass = { text: text !== false, ctx: target.ctx, diff: diff.ctx, words, root: null, shift, vw, vh };
  const all = [target.ctx, diff.ctx, ...(words ? [words.ctx, words.diff] : [])];
  for (const root of roots) {
    for (const c of all) c.save();
    pass.root = root;
    try {
      walk(pass, root, 1);
    } catch {
      /* one element the rasteriser tripped on does not lose the picture */
    }
    pass.ctx = target.ctx;
    for (const c of all) c.restore();
  }
}
