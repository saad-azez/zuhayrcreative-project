"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * The Expand button's glass turning INTO its arrow.
 *
 * The client (1 Oct): the glass must turn into the Liquid Glass arrow
 * itself, not round into a circle holding a glyph. Then (8 Oct): the morph
 * "is not really looking like the ref, plus the arrow itself is not that
 * nice" — the first take clipped the pane to a 7-point block arrow the
 * width of the pill: squat, sharp-cornered, and flat, since a clip throws
 * away everything that makes the pane read as glass (the inset light, the
 * drop shadow, the rim).
 *
 * Now the arrow is a heavy, rounded one — a shaft and a chevron head of
 * one stroke weight, round caps — centred in the pill. The morph is a pour
 * rather than a tween: the pill thins and draws in to the shaft while the
 * head's two arms grow out of the tip, and in between a goo filter fuses
 * the parts, so the glass necks and beads like a liquid on its way.
 *
 * How: the shape is drawn as SVG (a rounded rect for the body, two
 * round-capped lines for the arms) and used twice, both rebuilt each frame
 * as data URLs:
 *  - as the glass's mask-image, so the frost, the grain and the backdrop
 *    it blurs are cut to the arrow — the arrow IS the pane;
 *  - as the background of `edge`, a layer over the glass that gives the
 *    cut shape the glass's light back: a bright top edge, a dark inner
 *    bottom edge, a sheen, the chrome rim with its crimson glint, and a
 *    drop shadow outside the shape.
 * `--morph` (0..1) on the host carries the crossfades to CSS. At rest
 * there is no mask at all — the pill is the plain skin.
 *
 * Pointer hover (mouse and pen) and keyboard focus only: on touch there is
 * no hover, and a tap opens the detail straight away. Nothing under
 * reduced motion.
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const f = (v: number) => v.toFixed(2);

/** Room round the box for the edge layer's drop shadow, in px. */
const PAD = 14;

type Geo = { w: number; h: number };

/**
 * The shape at morph `m` (may overshoot past 1 under the ease): its SVG
 * elements without paint (the user of it sets fill and stroke), and the
 * goo blur to fuse them with (0 at both ends, so the pill and the arrow
 * are crisp).
 */
function shapeAt({ w, h }: Geo, m: number) {
  const cx = w / 2;
  const cy = h / 2;
  // The arrow, in proportion to the pill's height.
  const sw = h * 0.27; // stroke weight of shaft and arms
  const reach = h * 0.3; // how far each arm runs back and out from the tip
  const len = h * 1.8; // tail cap to tip cap
  const tail = cx - len / 2 + sw / 2;
  const tip = cx + len / 2 - sw / 2;

  // The body: the pill thinning and drawing in to the shaft. It leads; the
  // arms follow, sprouting once the body has started to neck.
  const b = Math.max(0, m);
  const bh = Math.max(sw * 0.7, lerp(h, sw, b));
  const x0 = lerp(0, tail - sw / 2, clamp01(b));
  const x1 = lerp(w, tip, clamp01(b));
  const rx = Math.min(bh / 2, lerp(10, sw / 2, clamp01(b)));
  const a = Math.max(0, (m - 0.18) / 0.82) * reach;

  let els =
    `<rect stroke="none" x="${f(x0)}" y="${f(cy - bh / 2)}" width="${f(x1 - x0)}" height="${f(bh)}" rx="${f(rx)}"/>`;
  if (a > 0.3) {
    els +=
      `<path fill="none" stroke-width="${f(sw)}" stroke-linecap="round" stroke-linejoin="round" ` +
      `d="M${f(tip - a)} ${f(cy - a)}L${f(tip)} ${f(cy)}L${f(tip - a)} ${f(cy + a)}"/>`;
  }
  const goo = 2.4 * Math.max(0, Math.sin(Math.PI * clamp01(m)));
  return { els, goo };
}

const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** The goo filter: blur, then pull the alpha back to a hard edge. */
const gooFilter = (blur: number) =>
  `<filter id="g" x="-30%" y="-60%" width="160%" height="220%" color-interpolation-filters="sRGB">` +
  `<feGaussianBlur stdDeviation="${f(blur)}"/>` +
  `<feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 12 -5"/></filter>`;

function maskSvg(geo: Geo, m: number) {
  const { els, goo } = shapeAt(geo, m);
  const g = goo > 0.05;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${geo.w}" height="${geo.h}" viewBox="0 0 ${geo.w} ${geo.h}">` +
    (g ? `<defs>${gooFilter(goo)}</defs>` : "") +
    `<g fill="#fff" stroke="#fff"${g ? ` filter="url(#g)"` : ""}>${els}</g></svg>`
  );
}

function edgeSvg(geo: Geo, m: number) {
  const { w, h } = geo;
  const { els, goo } = shapeAt(geo, m);
  const g = goo > 0.05;
  const W = w + PAD * 2;
  const H = h + PAD * 2;
  // Every layer is this shape, painted differently and run through its
  // own filter; `layer` passes the paint down to the rect and the arms.
  const layer = (paint: string, extra = "") =>
    `<use href="#s" fill="${paint}" stroke="${paint}" ${extra}/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${-PAD} ${-PAD} ${W} ${H}">` +
    `<defs>` +
    (g ? gooFilter(goo) : "") +
    `<g id="s"${g ? ` filter="url(#g)"` : ""}>${els}</g>` +
    // Drop shadow, kept outside the shape so it never dims the pane.
    `<filter id="sh" x="-40%" y="-80%" width="180%" height="260%">` +
    `<feGaussianBlur in="SourceAlpha" stdDeviation="3.2"/><feOffset dy="3.5" result="b"/>` +
    `<feFlood flood-color="#000" flood-opacity="0.42"/><feComposite in2="b" operator="in"/>` +
    `<feComposite in2="SourceAlpha" operator="out"/></filter>` +
    // A lit edge: the shape minus itself moved by (dx, dy).
    `<filter id="top" x="-10%" y="-20%" width="120%" height="140%"><feOffset in="SourceAlpha" dy="1.6" result="o"/>` +
    `<feComposite in="SourceGraphic" in2="o" operator="out"/></filter>` +
    `<filter id="bot" x="-10%" y="-20%" width="120%" height="140%"><feOffset in="SourceAlpha" dy="-1.6" result="o"/>` +
    `<feComposite in="SourceGraphic" in2="o" operator="out"/></filter>` +
    // The rim: the shape minus itself eroded.
    `<filter id="rim" x="-10%" y="-20%" width="120%" height="140%">` +
    `<feMorphology in="SourceAlpha" operator="erode" radius="1.1" result="i"/>` +
    `<feComposite in="SourceGraphic" in2="i" operator="out"/></filter>` +
    // The sheen: light from above, falling off before the middle.
    `<linearGradient id="sheen" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${h}">` +
    `<stop offset="0.15" stop-color="#fff" stop-opacity="0.26"/>` +
    `<stop offset="0.5" stop-color="#fff" stop-opacity="0.04"/>` +
    `<stop offset="0.85" stop-color="#000" stop-opacity="0.1"/></linearGradient>` +
    // The rim's chrome: the skin's silver bands and its one crimson glint.
    `<linearGradient id="chrome" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w}" y2="${h}">` +
    `<stop offset="0" stop-color="#fff"/><stop offset="0.22" stop-color="#9aa0aa"/>` +
    `<stop offset="0.4" stop-color="#eef1f5"/><stop offset="0.55" stop-color="#5d626c"/>` +
    `<stop offset="0.62" stop-color="#ff5a6e"/><stop offset="0.7" stop-color="#f5f7fa"/>` +
    `<stop offset="1" stop-color="#c9ced8"/></linearGradient>` +
    `</defs>` +
    `<g filter="url(#sh)">${layer("#000")}</g>` +
    layer("url(#sheen)") +
    `<g filter="url(#bot)" opacity="0.4">${layer("#000")}</g>` +
    `<g filter="url(#rim)" opacity="0.75">${layer("url(#chrome)")}</g>` +
    `<g filter="url(#top)" opacity="0.9">${layer("#fff")}</g>` +
    `</svg>`
  );
}

/** Returns the four refs to put on the button, the shape wrapper, the glass and the edge layer. */
export function useArrowMorph() {
  const trigger = useRef<HTMLButtonElement>(null);
  const host = useRef<HTMLSpanElement>(null);
  const glass = useRef<HTMLSpanElement>(null);
  const edge = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const hostEl = host.current;
    const glassEl = glass.current;
    const edgeEl = edge.current;
    const btn = trigger.current;
    if (!hostEl || !glassEl || !edgeEl || !btn) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const state = { m: 0 };
    const geo: Geo = { w: 0, h: 0 };
    const measure = () => {
      geo.w = glassEl.offsetWidth;
      geo.h = glassEl.offsetHeight;
    };
    const apply = () => {
      hostEl.style.setProperty("--morph", clamp01(state.m).toFixed(3));
      if (state.m < 0.002 || !geo.w) {
        glassEl.style.removeProperty("mask-image");
        glassEl.style.removeProperty("-webkit-mask-image");
        edgeEl.style.backgroundImage = "";
        return;
      }
      const mask = svgUrl(maskSvg(geo, state.m));
      glassEl.style.setProperty("mask-image", mask);
      glassEl.style.setProperty("-webkit-mask-image", mask);
      edgeEl.style.backgroundImage = svgUrl(edgeSvg(geo, state.m));
    };
    measure();
    apply();
    const ro = new ResizeObserver(() => {
      measure();
      apply();
    });
    ro.observe(glassEl);

    let tween: gsap.core.Tween | null = null;
    const to = (m: number) => {
      tween?.kill();
      tween = gsap.to(state, {
        m,
        duration: m ? 0.75 : 0.5,
        // In: a liquid overshoot — the shaft necks thinner and the head
        // runs long past their marks, then settle. Out: straight home.
        ease: m ? "back.out(1.9)" : "power3.out",
        onUpdate: apply,
      });
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      to(1);
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      to(0);
    };
    const onFocus = () => {
      if (btn.matches(":focus-visible")) to(1);
    };
    const onBlur = () => to(0);

    btn.addEventListener("pointerenter", onEnter);
    btn.addEventListener("pointerleave", onLeave);
    btn.addEventListener("focus", onFocus);
    btn.addEventListener("blur", onBlur);
    return () => {
      tween?.kill();
      ro.disconnect();
      btn.removeEventListener("pointerenter", onEnter);
      btn.removeEventListener("pointerleave", onLeave);
      btn.removeEventListener("focus", onFocus);
      btn.removeEventListener("blur", onBlur);
      glassEl.style.removeProperty("mask-image");
      glassEl.style.removeProperty("-webkit-mask-image");
      edgeEl.style.backgroundImage = "";
      hostEl.style.removeProperty("--morph");
    };
  }, []);

  return { trigger, host, glass, edge };
}
