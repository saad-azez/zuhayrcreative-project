"use client";
import { isPhoneDevice } from "@/app/lib/device";

/**
 * Edge tunnel for the works rail — the services section's WebGL distortion,
 * transposed onto the horizontal axis and fed images instead of a text strip.
 *
 * WHY THIS IS GL AND NOT A TRANSFORM
 * The distortion wanted here stretches each picture vertically while
 * compressing it horizontally, by an amount that varies ACROSS the picture's
 * own width. That is a per-vertex warp of a subdivided mesh. A CSS transform
 * applies one matrix to a whole element, so the best it can manage is fanning a
 * slat uniformly — and the gradient across the slat is precisely the part that
 * reads as depth rather than as a resize.
 *
 * WHAT IT DRAWS
 * By default, only the slats inside the edge bands. The middle of the rail
 * stays DOM and is untouched: this canvas is transparent there and draws
 * nothing, so the row you hover and click is still the real one. A slat
 * crossing into a band fades out in the DOM as its GL copy fades in — that
 * crossfade is the seam.
 *
 * A caller can instead ask for a slat as a liquid-glass SLAB (TunnelSlat.glass,
 * the works strip): then the canvas draws the whole picture, refracted through
 * a bevelled rounded box (see GLASS), the caller hides its DOM picture, and the
 * flare at the rim is drawn on top of the slab exactly as before. The DOM
 * still owns whatever must stay DOM — caption, hover, shadow — and hands its
 * caption over to the baked one at the same seam.
 *
 * THE TRANSPOSITION
 * WebGLTextTunnel builds its mask off `vUv.y - 0.5`, pinching at the top and
 * bottom of the screen:
 *
 *     float mask    = pow(abs(relY) * 2.0, expo);   // 0 centre, 1 at edges
 *     float xExpand = 1.0 + mask * stretchX;        // widen ACROSS travel
 *     float depth   = mask * stretchY;              // squash ALONG travel
 *
 * The rail travels horizontally, so the mask is built off screen X and the two
 * axes swap: pictures stretch VERTICALLY (across travel) and compress
 * HORIZONTALLY (along travel) as they near a side. Same relationship, same
 * curve, rotated a quarter turn.
 */

/**
 * A texture source. A canvas is accepted alongside an image so a caller can
 * hand over a COMPOSED plate — picture plus caption baked together — and have
 * the whole thing warp as one: anything living only in the DOM (a caption, a
 * scrim) is otherwise sliced off at the clip seam, because the tail redraws
 * from the texture alone.
 */
export type TunnelSource = HTMLImageElement | HTMLCanvasElement;

const sourceSize = (s: TunnelSource): { w: number; h: number } =>
  s instanceof HTMLImageElement
    ? { w: s.naturalWidth, h: s.naturalHeight }
    : { w: s.width, h: s.height };

const sourceReady = (s: TunnelSource): boolean =>
  s instanceof HTMLImageElement
    ? s.complete && s.naturalWidth > 0
    : s.width > 0 && s.height > 0;

export interface TunnelSlat {
  /** Screen rect of the slat, css px, y-down. */
  x: number;
  y: number;
  w: number;
  h: number;
  img: TunnelSource;
  /**
   * `tan(theta) / perspective` for a caller whose DOM copies carry a per-plate
   * `scaleY(s) perspective(d) rotateY(theta) scaleX(1/cos theta)`.
   *
   * That transform maps a plate's own x as `x / (1 + x * skew)` about its
   * centre — a quadratic bow reaching several px at the plate's edges. The GL
   * copy drew a FLAT rect, so the two copies of one picture sat a few pixels
   * apart and the handoff showed as a ghosted double image (a doubled letter
   * in a caption is the giveaway) with a line at either end of the overlap.
   * Pass this and the shader applies the identical map. Omit it (0) and the
   * geometry is exactly what it always was.
   */
  skew?: number;
  /**
   * That same transform's `scaleY`. Pair it with `skew`, and pass `arcBow` 0:
   * the per-plate scale IS the row's arc as the DOM draws it, so letting the
   * shader add its own per-vertex arc on top would bow the copy twice.
   * Defaults to 1 — no change for callers that do not scale their plates.
   */
  scaleY?: number;
  /**
   * The picture's own box, when it is WIDER than the slat and slides inside
   * it (the works strip's parallax). In slat units: a point at slat-u samples
   * the texture at box-u `(u + u0) * su`, so `su` is the slat's width as a
   * fraction of the box's and `u0` is where the slat's left edge sits in the
   * box, in slat widths. The cover crop is then computed against the BOX's
   * aspect, exactly as the DOM sizes an <img> against the box rather than
   * the bar. Omit it and the texture is cover-fitted to the slat itself.
   */
  pic?: { u0: number; su: number };
  /**
   * A caption strip laid on the FACE of the slab at slat coordinates — not
   * refracted, so it stays pixel-identical to its DOM twin across the clip
   * seam — covering slat-v from `capY0` to 1 and faded in with the seam, the
   * way the composed plate used to be. Transparent where there is no type.
   */
  cap?: TunnelSource;
  capY0?: number;
  /**
   * Where the caller's DOM copy of the caption is cut: its `clip-path:
   * inset()` left and right, px in the plate's OWN (untransformed) box.
   * Given, the baked caption is drawn exactly where the DOM's has been cut
   * away and nowhere else, so the two meet edge to edge. Without it the
   * baked caption fades in with `seam`, which is where the DOM's clip WOULD
   * be without any overlap — and a caller that draws its DOM copy a few px
   * past the seam (WorksStrip's OVERLAP) then paints the translucent scrim
   * twice across that strip: a dark vertical line down the caption of every
   * bar entering the lens. Pass `null` for a plate the DOM is not clipping
   * at all: then the baked caption stays off.
   */
  capClip?: { l: number; r: number } | null;
  /**
   * The hover vignette, 0..1: the two dark top-corner falloffs the works
   * strip used to paint with a DOM `::after`. That one was clipped at the
   * lens seam with the rest of the DOM copy, so a hovered bar entering the
   * lens showed its vignette ending in a hard vertical line. Drawn here it
   * travels through the lens with the bar.
   */
  vignette?: number;
  /**
   * Draw the whole slat as a liquid-glass slab (see GLASS), not just its
   * tail. The caller hides its DOM picture: the slab IS the picture now, and
   * the tail's flare is drawn on top of it at the rim as before.
   */
  glass?: boolean;
}

/* ── The slab ──
   The reference (shadersweden's liquid-glass carousel, Aug 2026): no built-in
   glass, a custom shader on a plane. A rounded-box SDF cuts the silhouette;
   distance from the edge drives a bevel HEIGHT FIELD, and the surface normal
   is rebuilt from that slope (plus the grid's gentle curvature), which is
   what gives the corners their weight. The view ray is refracted through the
   rebuilt normal and the picture is sampled where the ray leaves the slab —
   three rays at slightly different IORs split the channels for the
   dispersion on the bevel. Fresnel and a streak light the rim.

   All lengths are fractions of the BAR'S WIDTH, so a 9vw desktop bar and a
   37vw phone bar are the same slab at different sizes. */
export const GLASS = {
  /**
   * Corner radius, in CSS px — NOT a fraction of the width like the rest.
   * The bars keep the shape they always had (the plate's 3px corner): the
   * client asked for the slab's glass, texture and depth, not a new
   * silhouette, and 13% of the width rounded a phone bar into a pill.
   */
  RADIUS_PX: 3,
  /**
   * The bevel's width — how far in from the rim the surface is still
   * curving. The reference's cards bevel over ~6% of their width, but they
   * are 4:3; on a 1:5 bar that would be 8px, too fine to read as anything.
   */
  BEVEL: 0.14,
  /** Bevel height over bevel width: how steeply the rim falls away. */
  SLOPE: 0.7,
  /**
   * How far a refracted ray travels before it meets the picture, i.e. the
   * slab's thickness. The whole size of the edge distortion.
   */
  THICK: 0.26,
  /** The grid's sphere curvature, folded into the normal as a gentle lens. */
  CURVE: 0.04,
  /** Refractive index per channel — the spread is the dispersion. */
  IOR: [1.42, 1.5, 1.6] as const,
  /**
   * The film on the face: the painted glass the bars wore before they were
   * slabs (a lit top edge with the sheen raking down off it, the pane's body
   * darkening toward its foot, one specular band across it), laid over the
   * slab's own lighting (client, 14 Oct: "add the texture you had in the
   * previous version on top of the new glass bevel"). 1 is that film at the
   * strength it had; 0 takes it off.
   *
   * It went on 23 Sep with the reasoning that a painted sheen cannot bend
   * the picture and the slab does. Both are true at once: the slab bends
   * the picture, and this is what the light does on the surface over it.
   * The film's hairline rims are not brought back: the bevel's own Fresnel
   * edge is the rim now, and a second line inside it read as a double edge.
   */
  FILM: 1,
};

export interface RailTunnel {
  render(
    slats: TunnelSlat[],
    vw: number,
    vh: number,
    centerY: number,
    halfH: number,
    dpr: number,
    /**
     * 0 where the strip has run out on that side, 1 where it continues. Default
     * 1/1 keeps the flare on both edges for callers that do not track it.
     */
    leftGate?: number,
    rightGate?: number,
    /**
     * Row-wide concave arc: extra Y-scale at the window edge, quadratic from
     * the centre (see uArcBow in the vertex shader). Callers passing a
     * non-zero bow must hand over untransformed rects and mirror the curve's
     * tangent on their DOM copies. Default 0 — no arc.
     */
    arcBow?: number,
    /**
     * The lens width, as a fraction of `vw`. Defaults to BAND — the value the
     * reference's WIDE plates were measured against. Callers whose pictures
     * are narrower than that lens (the works strip's bars) must pass
     * `flareBand(barWidth, vw)` instead, or the whole picture disperses at
     * once and the turn stops reading. See flareBand.
     */
    band?: number,
  ): void;
  /**
   * True once the shader program has turned out not to link. The program is
   * finished lazily (see `finish` in createRailTunnel), so a caller learns of
   * a failure after creation rather than from a null return, and should fall
   * back to whatever it shows without a tunnel.
   */
  failed(): boolean;
  /**
   * Free a source's texture. Textures are keyed on the source element and a
   * WeakMap entry does not free GPU memory when the element goes: a caller
   * that replaces a source (a re-bake after a resize, or the bake taking over
   * from the full-size photograph it was cut from) must release the old one
   * or it stays on the GPU for the life of the context.
   */
  release(src: TunnelSource): void;
  dispose(): void;
}

/* ── Feel ── */
/**
 * uEdgeZone — the flare's reach, as a fraction of window width.
 *
 * 0.13, measured off the client's recording of the reference (their lens
 * spans ~150px of a 1164px window). The lens is a FIXED region of the screen
 * that content slides through — the layout itself is never touched, so the
 * zone must stay narrow: everything outside it is the plain layout, and all
 * of the turn's drama lives in the last few percent before the rim.
 */
export const BAND = 0.13;
/**
 * How tightly the warp hugs the very edge — and, just as importantly, how
 * CURVED it is. This exponent is what makes the lens invisible where it
 * begins and dramatic at the rim: pow(t, 2.6) enters at ZERO SLOPE (tangent
 * to the flat middle — no kink, no start-line) and accelerates hard in the
 * final few percent, which is what reads as the surface wrapping 90° around
 * a rounded corner. 2.6 is the reference's own value, read off their shader;
 * an intermediate pass eased it to 2.2 and the turn lost exactly that
 * character.
 */
export const EXPO = 2.6;
/**
 * uFan — how far the sheet flares at the very edge.
 *
 * There is no horizontal term, and that is the point. Their vertex shader ends
 * `float nx = sx * 2.0 - 1.0;` — X passes through completely untouched, and
 * ONLY Y is scaled. An earlier version here compressed X toward the screen edge
 * as well, which is not in their shader at all: it dragged each picture into a
 * thin sliver against the edge instead of letting the sheet bow, and because it
 * moved pictures sideways it was also what made them ride over their
 * neighbours. With X left alone, adjacent slats stay adjacent by construction
 * and cannot collide.
 *
 * 0.32, not the reference's 0.6: the flare now sits ON TOP of the row-wide
 * arc (uArcBow), which already lifts a rim bar to ~1.2x. Compounding 1.6
 * onto that reached ~1.92x — visibly harder than the reference's 1.6 cap —
 * so the flare's own share is trimmed to land the COMBINED stretch at
 * 1.2 x 1.32 ≈ 1.58, the reference's total. (Also what keeps the deepest bow
 * inside the works strip's 140% canvas headroom.)
 */
const STRETCH_Y = 0.32;
/** Spectral fan width, in texture units. */
const CHROMA = 0.075;
/** Luminance-keyed red bleed on top of the fan — the services tunnel's 0.85. */
const BLEED = 0.85;

/**
 * The DOM → GL handoff, as a function of a slat's centre.
 *
 * The ramp is a HAIRLINE, and deliberately so. It was a broad crossfade over
 * the outer half of the band, which meant that for the whole of that ramp a
 * warped GL copy and an unwarped DOM copy of the same slat were both on screen
 * at once — two different geometries of one picture, overlapping. That is the
 * collision.
 *
 * The reference hands over with `smoothstep(2e-4, 3e-4, edge)`: a swap so tight
 * it completes while the warp is still worth ~0.0002 of a pixel, i.e. while the
 * GL copy is still pixel-identical to the DOM one. Nothing visibly crosses
 * because there is nothing yet to see. Same idea here — by the time the warp is
 * legible, the DOM copy is long gone and only the sheet remains.
 */
export function handoff(centreX: number, vw: number): number {
  return handoffAt(Math.min(centreX, vw - centreX), vw);
}

/**
 * The same curve, driven by a distance in px from the nearer window edge.
 *
 * Prefer this for wide plates. Keying the handoff off a plate's CENTRE means a
 * 660px plate does not qualify until it is about 80% off-screen, so the flare
 * never fires on it at all — the band is only 10% of the window. What matters
 * is whether ANY part of the plate has entered the band, because the warp
 * itself is per-vertex and will simply be zero across the parts that have not.
 */
/**
 * Where the DOM stops and the GL tail begins, as a fraction of window width.
 *
 * Solved rather than guessed, exactly as they solve it: walk in from the edge
 * of the zone until `seam` — smoothstep(2e-4, 3e-4, edge) — reaches 0.99, i.e.
 * the first point at which the GL tail is fully opaque. Clipping the DOM there
 * means the two meet with neither a gap nor an overlap. Works out at 0.0874 of
 * the width, ~126px on a 1440 window.
 */
export const CLIP = (() => {
  const ss = (a: number, b: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let n = BAND; n > 0; n -= 1e-5) {
    // `m` must be EXACTLY what the vertex shader computes —
    // `clamp(1.0 - dist / uBand, 0.0, 1.0)`, which is linear. An earlier
    // version ran that through a smoothstep as well, and the extra curve made
    // the solver believe the mask climbs far faster than it does: it handed
    // over at 0.874 of the band instead of 0.956.
    //
    // That is where the edge line came from. At 0.874 the shader's mask is
    // already 4.6e-3, so `fx` — the gate that is supposed to hold the chroma
    // off until the warp is genuinely bending — is 0.31 open. The picture
    // therefore jumped from untinted DOM to 31%-dispersed GL across one hard
    // vertical line, which is exactly the mismatch between a plate's edge and
    // the image coming out of it. Solved against the real mask the seam lands
    // where `fx` is 0.000 and the two sides meet at identical colour.
    const m = Math.max(0, Math.min(1, 1 - n / BAND));
    if (ss(0.0002, 0.0003, Math.pow(m, EXPO)) >= 0.99) return n;
  }
  return BAND * 0.996;
})();

/**
 * CLIP expressed as a fraction of the band.
 *
 * The solver above depends only on the RATIO n/BAND — `ss(BAND, 0, n)` is
 * smoothstep run backwards, i.e. `clamp(1 - n/BAND)` — so the clip always
 * lands at the same fraction of whatever band is in force. That is what lets
 * the band become a per-render value without re-solving it every frame.
 */
export const CLIP_RATIO = CLIP / BAND;

/** How much of ONE bar the lens spans. See `flareBand`. */
export const BAND_OF_BAR = 0.62;

/**
 * The band a strip of bar-width pictures should use, as a fraction of `vw`.
 *
 * BAND's 0.13 was measured against the reference's WIDE plates, where a
 * picture is several times the lens: the plate's leading edge bends and
 * disperses while the rest of it stays flat and legible, and that contrast
 * IS the effect — a photograph turning a corner.
 *
 * The work strip's bars broke that on both ends. At 9vw a bar is NARROWER
 * than the 0.13 lens, so the whole picture is inside it at once: nothing
 * stays flat, everything disperses together, and it reads as a red smear
 * rather than a picture. On a phone the ratio inverts — a 37vw bar against a
 * 0.13 lens is ~51px — so only a sliver of the leading edge ever warps and
 * the effect disappears outright.
 *
 * Keying the lens to the BAR rather than the window fixes both: every bar
 * makes the same relative journey through it at every viewport, always
 * keeping a flat body while its leading edge turns. The bar shape is the
 * fixed thing here, so the lens is what has to move.
 */
export function flareBand(barPx: number, vw: number): number {
  if (!(barPx > 0) || !(vw > 0)) return BAND;
  return Math.max(0.03, Math.min(0.32, (barPx * BAND_OF_BAR) / vw));
}

export function handoffAt(distPx: number, vw: number): number {
  const dist = distPx / vw;
  const t = Math.max(0, Math.min(1, 1 - dist / BAND));
  const mask = Math.pow(t, EXPO);
  const a = 0.0002;
  const b = 0.0003;
  const s = Math.max(0, Math.min(1, (mask - a) / (b - a)));
  return s * s * (3 - 2 * s);
}

const VERT = [
  "attribute vec2 aUv;",
  "uniform vec4 uRect;",     // x, y, w, h (css px, y-down)
  "uniform vec2 uRes;",
  "uniform float uCenterY;", // shared by every slat, so the row fans as one sheet
  "uniform float uBand;",
  "uniform float uExpo;",
  "uniform float uStretchY;",
  "uniform float uLeftGate;",  // 0 when there is no strip left of the window
  "uniform float uRightGate;", // 0 when there is no strip right of it
  // Full-width concave arc — the curved-screen bow ACROSS the whole row, not
  // just the edge bands. 0 for callers that don't use it. A caller that does
  // must hand over UNTRANSFORMED rects and apply the same parabola's tangent
  // (skewY + scaleY) to its DOM copies, so the two sides of the handoff seam
  // agree; the shader's per-vertex version is the exact curve, the DOM's
  // per-plate version its linearisation, and across one slat's width the two
  // differ by well under a pixel.
  "uniform float uArcBow;",
  "uniform float uSkewX;", // the DOM's perspective map; 0 = flat rect
  "uniform float uScaleY;", // the DOM's per-plate scaleY; 1 = untouched
  "varying vec2 vUv;",
  "varying float vMask;",
  "varying float vY;",
  "void main() {",
  "  vUv = aUv;",
  // Where this VERTEX sits on screen — not the slat's centre. Computing the
  // mask per-vertex is the whole point: the two sides of one picture get
  // different amounts, and that gradient is what reads as depth.
  // The plate's own x, mapped exactly as its DOM twin is mapped. uRect is
  // the UNTRANSFORMED layout rect, so this is the whole transform, not a
  // correction on top of one. Centre-preserving: x = 0 maps to 0.
  // ── The DOM's own transform, reproduced exactly ──
  // A caller whose plates carry `scaleY(s) perspective(d) rotateY(t)
  // scaleX(1/cos t)` maps its own local point about the plate centre as
  //     w = 1 + lx * tan(t)/d ,  X = lx / w ,  Y = s * ly / w
  // The perspective divide applies to Y as well as X — that is what
  // tilts a plate's TOP and BOTTOM edges. Leaving it out of the GL copy
  // left those two edges meeting their DOM halves at an angle, which is
  // the step seen along the top and bottom of every edge bar. With both
  // terms here the two copies are the same shape by construction, not
  // to within a pixel.
  "  float lx = (aUv.x - 0.5) * uRect.z;",
  "  float ly = (aUv.y - 0.5) * uRect.w;",
  "  float pw = 1.0 + lx * uSkewX;",
  "  vec2 screen = vec2(uRect.x + uRect.z * 0.5 + lx / pw,",
  "                     uRect.y + uRect.w * 0.5 + uScaleY * ly / pw);",
  "  float sx = screen.x / uRes.x;",
  "  float dist = min(sx, 1.0 - sx);",
  "  float m = clamp(1.0 - dist / uBand, 0.0, 1.0);",
  "  float mask = pow(m, uExpo);",
  // ── End gates ──
  // At either scroll limit there is nothing beyond the outermost plate, so a
  // bow there has no neighbour to bend away from: the plate flares against bare
  // canvas and its own silhouette reads as a hard dark edge down the side. That
  // is the black line. Their shader gates it with exactly this line, killing
  // the warp on whichever side has run out of strip so the last plate sits
  // flat.
  "  mask *= mix(uLeftGate, uRightGate, step(0.5, sx));",
  // Ramp the warp with the same curve as the handoff, so the flat DOM copy and
  // the warped GL one stay aligned through the seam — their comment for this
  // line notes that a hard step here leaves white gaps and vertical tears.
  "  float blend = smoothstep(0.0002, 0.0003, mask);",
  // The row-wide arc: quadratic in the vertex's distance from screen centre,
  // flat at the apex — computed per-VERTEX, so a slat's top and bottom edges
  // genuinely curve along it instead of stepping.
  "  float dxc = (sx - 0.5) * 2.0;",
  "  float arc = 1.0 + uArcBow * dxc * dxc;",
  // Across travel: the arc first, then the edge flare's stretch away from the
  // shared centreline on top of it.
  "  float y = uCenterY + (screen.y - uCenterY) * arc * (1.0 + uStretchY * mask * blend);",
  // X passes through untouched — see the note on STRETCH_Y.
  "  gl_Position = vec4(sx * 2.0 - 1.0, 1.0 - (y / uRes.y) * 2.0, 0.0, 1.0);",
  "  vMask = mask;",
  "  vY = y;",
  "}",
].join("\n");

const FRAG = [
  "precision highp float;",
  "varying vec2 vUv;",
  "varying float vMask;",
  "varying float vY;",
  "uniform sampler2D uTex;",
  "uniform float uChroma;",
  "uniform float uBleed;",
  "uniform float uFade;",
  "uniform float uCenterY;",
  "uniform float uHalfH;",
  "uniform vec2 uUvScale;",   // object-fit: cover crop
  "uniform vec2 uUvOffset;",
  "uniform vec4 uRect;",      // the slat's untransformed rect, css px — the slab's size
  // ── The slab (see GLASS) ──
  "uniform float uGlass;",    // 1: draw the slab everywhere; 0: the tail only, as before
  "uniform float uRadius;",   // corner radius, px
  "uniform float uBevel;",    // bevel width, px
  "uniform float uSlope;",    // bevel height / bevel width
  "uniform float uThick;",    // slab thickness, px
  "uniform float uCurve;",    // the grid's curvature, as a lens across the face
  "uniform vec3 uEta;",       // 1 / IOR, per channel
  "uniform sampler2D uCap;",  // the caption strip, on the face
  "uniform float uHasCap;",
  "uniform float uCapY0;",    // slat-v where the strip starts
  "uniform vec3 uCapCut;",    // the DOM caption's clip: left px, right px, 1 = use it
  "uniform float uVignette;", // hover vignette, 0..1 (TunnelSlat.vignette)
  // The services tunnel's own ramp: ember -> hot red -> scarlet -> brand red
  // -> crimson -> deep maroon. It spans a WIDE spread of reds on purpose; a
  // ramp sitting entirely in the dark half averages back to a muddy near-grey
  // across eight samples and the dispersion stops registering at all.
  "vec3 brandChroma(float t) {",
  "  vec3 c0 = vec3(1.0000, 0.4118, 0.1176);", // #FF691E ember
  "  vec3 c1 = vec3(1.0000, 0.1373, 0.0588);", // #FF230F hot red
  "  vec3 c2 = vec3(0.9412, 0.0196, 0.0706);", // #F00512 scarlet
  "  vec3 c3 = vec3(0.7686, 0.0039, 0.0510);", // #C4010D brand red
  "  vec3 c4 = vec3(0.6039, 0.0000, 0.1216);", // #9A001F crimson
  "  vec3 c5 = vec3(0.3765, 0.0000, 0.1490);", // #600026 deep maroon
  "  float x = clamp(t, 0.0, 1.0) * 5.0;",
  "  if (x < 1.0) return mix(c0, c1, x);",
  "  if (x < 2.0) return mix(c1, c2, x - 1.0);",
  "  if (x < 3.0) return mix(c2, c3, x - 2.0);",
  "  if (x < 4.0) return mix(c3, c4, x - 3.0);",
  "  return mix(c4, c5, x - 4.0);",
  "}",
  // object-fit: cover, in the shader. Without it the GL copy samples the raw
  // image 0..1 while its DOM twin is cover-cropped, so the two show DIFFERENT
  // crops of the same photo and the picture visibly jumps at the handoff. That
  // jump is the tearing seen while dragging. `b` is a SLAT coordinate; the
  // clamp keeps a refracted ray inside the picture (it bends inward anyway).
  "vec3 pic(vec2 b) {",
  "  return texture2D(uTex, uUvOffset + clamp(b, 0.0, 1.0) * uUvScale).rgb;",
  "}",
  // The caption strip, where there is one: slat-v from uCapY0 to the foot.
  "vec4 cap(vec2 b) {",
  "  if (uHasCap < 0.5 || b.y < uCapY0) return vec4(0.0);",
  "  return texture2D(uCap, vec2(b.x, (b.y - uCapY0) / (1.0 - uCapY0)));",
  "}",
  // The composed plate — picture, then the caption faded in with the seam:
  // the DOM keeps drawing its own caption up to the clip line and this one
  // takes over past it, so the two are complementary, never doubled.
  "vec3 plate(vec2 b, float seam) {",
  "  vec3 c = pic(b);",
  "  vec4 k = cap(b);",
  "  return mix(c, k.rgb, k.a * seam);",
  "}",
  // ── The tail's flare, on whatever colour the face already has ──
  // Their two gates: `fx` holds the chroma off until the warp is genuinely
  // bending, so brightness at the seam still matches the DOM copy exactly.
  // ── Dispersion, in the brand's colours ──
  // Their split is two samples on the R and B channels, which fans out to cyan
  // and red — an RGB rainbow. This site's services tunnel disperses through a
  // brand ramp instead, and that is the treatment wanted here, so the structure
  // is theirs and the palette is ours: eight samples fanned along the same Y
  // axis at the same widening offset, each tinted with a stop from the ramp.
  //
  // Kept identical to WebGLTextTunnel's ramp, stop for stop, so the two
  // sections disperse through the same colours.
  "vec3 flare(vec3 base, vec2 b, float seam) {",
  "  float fx = smoothstep(0.0003, 0.012, vMask);",
  "  float ca = uChroma * fx * (0.4 + vMask);",
  "  vec3 acc = vec3(0.0);",
  "  for (int i = 0; i < 8; i++) {",
  "    float t = float(i) / 7.0;",
  "    float off = (t - 0.5) * ca * 2.0;",
  "    acc += plate(vec2(b.x, b.y + off), seam) * brandChroma(t);",
  "  }",
  // The ramp averages ~0.78 red against ~0.10 green/blue, so a plain /8 would
  // also dim the fringe by a fifth. Renormalising against that mean keeps the
  // plate's brightness and spends it on saturation instead — without it the
  // dispersion just reads as the picture going dark at the edges.
  "  vec3 fringe = acc / 8.0 * 1.28;",
  // The services tunnel mixes on `pow(mask, 0.55)`, NOT on the fx gate — a
  // gradual climb rather than a slam to full red.
  "  float tint = pow(vMask, 0.55);",
  "  vec3 rgb = mix(base, fringe, tint);",
  // The same luminance-keyed bleed the services tunnel adds on top. Keyed to
  // the picture's own brightness so it lights what is there rather than
  // flooding the whole plate, and green/blue stay near zero so it deepens the
  // red instead of washing out to white.
  "  float lum = dot(base, vec3(0.299, 0.587, 0.114));",
  "  rgb += vec3(0.95, 0.05, 0.12) * lum * tint * uBleed;",
  "  return rgb;",
  "}",
  // ── The slab's silhouette: a rounded box, negative inside ──
  "float sdBox(vec2 p, vec2 hs, float r) {",
  "  vec2 q = abs(p) - (hs - r);",
  "  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;",
  "}",
  // …and its gradient — the outward direction to the nearest edge. Inside
  // the corner arcs it points from the arc's centre; along the sides it is
  // the side's own normal.
  "vec2 sdGrad(vec2 p, vec2 hs, float r) {",
  "  vec2 q = abs(p) - (hs - r);",
  "  vec2 m = max(q, 0.0);",
  "  vec2 g = (m.x + m.y > 0.0) ? normalize(m)",
  "         : (q.x > q.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));",
  "  return g * vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);",
  "}",
  // Where a view ray (straight down into the face) leaves the slab, per unit
  // of thickness: refract it through the rebuilt normal and follow it. With
  // the normal tilting OUTWARD on the bevel the ray bends inward, so the rim
  // shows a squeezed copy of the picture's interior — the reference's look.
  "vec2 bend(vec3 n, float eta) {",
  "  vec3 t = refract(vec3(0.0, 0.0, -1.0), n, eta);",
  "  return t.xy / max(-t.z, 0.05);",
  "}",
  // ── The film on the face (see GLASS.FILM) ──
  // works-strip.css's old .wstrip__plate::before, layer for layer, in the
  // slat's own box so it bows with the slab: uv.y is 0 at the top.
  "float ramp(float t, float a, float b) { return clamp((t - a) / (b - a), 0.0, 1.0); }",
  "vec3 film(vec3 rgb, vec2 uv, vec2 sz, float amt) {",
  // 3 (the bottom layer). The specular band, a 104deg linear-gradient:
  //   0 @26%, 0.10 @40%, 0.26 @47%, 0.07 @54%, 0 @66%.
  // CSS measures a gradient along its own line through the box's centre,
  // whose length is |w sin| + |h cos|.
  "  vec2 dir = vec2(0.9703, 0.2419);",
  "  float len = abs(sz.x * dir.x) + abs(sz.y * dir.y);",
  "  float s = dot((uv - 0.5) * sz, dir) / len + 0.5;",
  "  float band = 0.10 * ramp(s, 0.26, 0.40);",
  "  band = mix(band, 0.26, ramp(s, 0.40, 0.47));",
  "  band = mix(band, 0.07, ramp(s, 0.47, 0.54));",
  "  band = mix(band, 0.0, ramp(s, 0.54, 0.66));",
  "  rgb = mix(rgb, vec3(1.0), band * amt);",
  // 2. The pane's body darkening toward its foot: rgba(14,12,18), 0 @52%
  //    to 0.24 @100%.
  "  rgb = mix(rgb, vec3(0.055, 0.047, 0.071), 0.24 * ramp(uv.y, 0.52, 1.0) * amt);",
  // 1 (the top layer). The lit top edge and the sheen raking down off it:
  //    0.5 @0%, 0.16 @5%, 0.05 @20%, 0 @44%.
  "  float top = mix(0.5, 0.16, ramp(uv.y, 0.0, 0.05));",
  "  top = mix(top, 0.05, ramp(uv.y, 0.05, 0.20));",
  "  top = mix(top, 0.0, ramp(uv.y, 0.20, 0.44));",
  "  return mix(rgb, vec3(1.0), top * amt);",
  "}",
  "void main() {",
  // `seam` carries alpha across the DOM handoff.
  "  float seam = smoothstep(0.0002, 0.0003, vMask);",
  "  if (uGlass < 0.5) {",
  // ── The tail-only path, for callers that keep their DOM pictures ──
  // Nothing to compute where the tail does not exist: `seam` is 0 for every
  // fragment whose mask has not reached 2e-4, and a 0 there zeroes the whole
  // output. Bailing out first is exactly equivalent — vec4(0) is a no-op
  // under ONE / ONE_MINUS_SRC_ALPHA.
  "    if (vMask <= 0.0002) {",
  "      gl_FragColor = vec4(0.0);",
  "      return;",
  "    }",
  "    vec4 base = texture2D(uTex, uUvOffset + vUv * uUvScale);",
  "    vec3 rgb = flare(base.rgb, vUv, seam);",
  "    float a = base.a * uFade * seam;",
  "    gl_FragColor = vec4(rgb * a, a);",
  "    return;",
  "  }",
  // ── The slab ──
  // In the slat's own px, centred. uRect is the UNTRANSFORMED layout rect,
  // so the silhouette and the bevel bow with the quad exactly as the DOM's
  // rounded box does under the same transform.
  "  vec2 hs = uRect.zw * 0.5;",
  "  vec2 p = (vUv - 0.5) * uRect.zw;",
  "  float sd = sdBox(p, hs, uRadius);",
  // Coverage, antialiased over ~a css px.
  "  float cover = 1.0 - smoothstep(-0.6, 0.6, sd);",
  "  if (cover <= 0.0) {",
  "    gl_FragColor = vec4(0.0);",
  "    return;",
  "  }",
  // ── The bevel: a height field of the distance from the edge ──
  // Quarter-circle profile — the surface falls away steeply at the very rim
  // and eases into the flat face, which is what reads as a thick, pillowed
  // slab rather than a chamfer. Its slope is (1-t)/sqrt(1-(1-t)^2), infinite
  // at the rim, so it is capped: past ~7 the normal is flat to the face and
  // the refraction has already saturated.
  "  float d = max(-sd, 0.0);",
  "  float t = clamp(d / uBevel, 0.0, 1.0);",
  "  float it = 1.0 - t;",
  "  float slope = it / sqrt(max(1.0 - it * it, 0.03));",
  // The normal, rebuilt from that slope along the SDF's gradient, plus the
  // grid's curvature as a gentle lens across the whole face.
  "  vec2 g = sdGrad(p, hs, uRadius);",
  "  vec3 n = normalize(vec3(g * slope * uSlope + (p / hs) * uCurve, 1.0));",
  // ── Refraction, three rays ──
  // One per channel at its own IOR; the spread between them is the
  // dispersion on the bevel. The offsets are px of slab, so they are the
  // same size on a stretched rim bar as on a flat one.
  "  vec2 sz = uRect.zw;",
  "  vec2 bR = vUv + bend(n, uEta.r) * uThick / sz;",
  "  vec2 bG = vUv + bend(n, uEta.g) * uThick / sz;",
  "  vec2 bB = vUv + bend(n, uEta.b) * uThick / sz;",
  "  vec3 base = vec3(pic(bR).r, pic(bG).g, pic(bB).b);",
  // The caption sits ON the face, unrefracted — see TunnelSlat.cap. It is
  // on exactly where the DOM's copy has been clipped away (TunnelSlat.capClip),
  // with a one-px ramp to meet the clip's own antialiased edge; without a
  // clip to match it falls back to the seam.
  "  float lxp = vUv.x * sz.x;",
  "  float capOn = uCapCut.z > 0.5",
  "    ? max(clamp(uCapCut.x - lxp + 0.25, 0.0, 1.0),",
  "          clamp(lxp - (sz.x - uCapCut.y) + 0.25, 0.0, 1.0))",
  "    : seam;",
  "  vec4 k = cap(vUv);",
  "  base = mix(base, k.rgb, k.a * capOn);",
  // ── Lighting ──
  // The rim is thicker glass: it absorbs a little.
  "  vec3 rgb = base * (1.0 - 0.22 * it * it);",
  // Fresnel — the face reflects almost nothing head-on and nearly everything
  // at the rim, which is the bright line that runs round every card in the
  // reference — plus a streak from a light above-left, and a fainter one
  // from below-right, on the bevel facets that face them.
  "  float F = 0.04 + 0.96 * pow(1.0 - n.z, 5.0);",
  "  vec3 V = vec3(0.0, 0.0, 1.0);",
  "  vec3 H1 = normalize(normalize(vec3(-0.35, -0.8, 0.55)) + V);",
  "  vec3 H2 = normalize(normalize(vec3(0.5, 0.75, 0.5)) + V);",
  "  float spec = pow(max(dot(n, H1), 0.0), 60.0) * 0.9",
  "             + pow(max(dot(n, H2), 0.0), 60.0) * 0.35;",
  "  rgb += vec3(0.92, 0.97, 1.0) * (F * 0.85 + spec);",
  // The film, on top of the bevel and its lighting, and under the caption
  // (which sat over the film in the DOM too: paint order glass, vignette,
  // caption).
  `  rgb = film(rgb, vUv, sz, ${GLASS.FILM.toFixed(3)} * (1.0 - k.a * capOn));`,
  // The flare at the rim, on top of the glass, on the green ray's sample.
  "  if (vMask > 0.0002) rgb = flare(rgb, bG, capOn);",
  // NO vertical mask. There was one here, feathering the tail away past the
  // row's band to stop it running over the masthead — and it was the single
  // reason the effect never read as depth. The geometry bows correctly, but
  // masking it back inside a horizontal band cuts the bow off and leaves a
  // straight-edged rectangle: the picture's CONTENT curved while the picture
  // itself stayed square. The plates are given headroom in the layout instead
  // (see .cstrip__plate), so the flare has room to bow inside the canvas.
  // PREMULTIPLIED, as theirs is. A non-premultiplied canvas resolved with
  // MSAA leaves partially-covered edge pixels whose colour the compositor
  // then divides by a small alpha — which fringes them dark. Every quad edge
  // is such a boundary, so the wrap seam showed a black hairline. Emitting
  // premultiplied colour (and blending ONE / ONE_MINUS_SRC_ALPHA) leaves
  // nothing to divide and the fringe cannot occur.
  // The hover vignette: works-strip.css's old pair of
  // radial-gradient(70% 55% at <corner> 0%, rgba(0,0,0,0.6), transparent 72%),
  // in the slat's own box so it bows with it. Last, as the DOM layer sat
  // over the whole slab (under the caption, which it never reaches).
  "  if (uVignette > 0.0) {",
  "    vec2 e = vec2(0.7, 0.55);",
  "    float dl = length(vec2(vUv.x, vUv.y) / e);",
  "    float dr = length(vec2(1.0 - vUv.x, vUv.y) / e);",
  "    float al = 0.6 * clamp(1.0 - dl / 0.72, 0.0, 1.0);",
  "    float ar = 0.6 * clamp(1.0 - dr / 0.72, 0.0, 1.0);",
  "    rgb *= 1.0 - uVignette * (1.0 - (1.0 - al) * (1.0 - ar));",
  "  }",
  "  float a = cover * uFade;",
  "  gl_FragColor = vec4(rgb * a, a);",
  "}",
].join("\n");

/**
 * Compile WITHOUT asking whether it worked. `getShaderParameter(COMPILE_STATUS)`
 * straight after `compileShader` is a synchronous round trip that waits for the
 * GPU process to finish the compile — and the slab's fragment shader is a big
 * one. The answer is read later, through the program's link status, once the
 * compile has had time to finish in the background (see `finish`).
 */
function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

export function createRailTunnel(canvas: HTMLCanvasElement): RailTunnel | null {
  // WebGL2 first: WebGL1 cannot mipmap a non-power-of-two texture, and every
  // photo here is NPOT. Without mipmaps the minified plate aliases, and while
  // dragging that alias crawls — which reads as the picture tearing. Falls back
  // to WebGL1 (unmipmapped, still correct) where 2 is unavailable.
  // preserveDrawingBuffer: the marble seam above the work section draws this
  // canvas into its picture of the section's top (MarbleSeam's `onto`), at a
  // moment of its own, and a canvas without it reads as empty then: the band,
  // which covers the plates' tops, showed them cut off.
  const gl2 = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: !isPhoneDevice(), // full-screen quad + rects: no edges worth 4x the memory on a phone
    preserveDrawingBuffer: true,
  }) as WebGL2RenderingContext | null;
  const gl = (gl2 ??
    canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: !isPhoneDevice(), // full-screen quad + rects: no edges worth 4x the memory on a phone
      preserveDrawingBuffer: true,
    })) as WebGLRenderingContext | null;
  if (!gl) return null;
  const canMipmap = !!gl2;

  // Anisotropic filtering, if the driver offers it — asked ONCE, and asked
  // now, while the GPU has nothing queued. `getParameter` is a synchronous
  // round trip; it used to be asked per texture, and the first texture
  // arrives while the shaders below are still compiling, so it sat behind the
  // whole compile — measured at 58-67ms of main thread, mid-scroll.
  const aniso =
    gl.getExtension("EXT_texture_filter_anisotropic") ||
    gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
  const anisoMax: number = aniso
    ? Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1)
    : 0;
  // Lets the compile be polled without blocking, where the browser has it.
  const parallel = gl.getExtension("KHR_parallel_shader_compile") as {
    COMPLETION_STATUS_KHR: number;
  } | null;

  // ── Compile and link, and DON'T wait for either ──
  // The section arms a viewport and a half before it is on screen, i.e.
  // while the reader is mid-scroll towards it. Asking for the link status
  // here (and the uniform locations, which need a linked program) blocked the
  // main thread until the GPU had compiled the slab shader: 74ms on a desktop
  // GPU, in the middle of a scroll. The program is finished off lazily by
  // `finish` — polled without blocking where KHR_parallel_shader_compile
  // exists, and at the latest on the first frame drawn, by which time the
  // compile has had the whole approach to complete.
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);

  // ── Subdivided quad ──
  // COLS is what buys the gradient across a picture's width. At 1 column the
  // warp collapses to a single matrix per slat — i.e. back to what a CSS
  // transform could already do on its own.
  // The bow is a curve in X and a straight line in Y: for a fixed column,
  // y maps linearly, so rows buy nothing beyond the two the quad needs. Columns
  // are the entire smoothness budget — at 24 the curve was 27px of flat chord
  // per segment across a 660px plate, which is visible faceting along the
  // bowed edge. 128 puts a vertex every ~5px.
  const COLS = 128;
  const ROWS = 2;
  const verts: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c <= COLS; c++) verts.push(c / COLS, r / ROWS);
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const a = r * (COLS + 1) + c;
      const b = a + 1;
      const d = a + (COLS + 1);
      const e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
  }
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);

  // The program's attribute and uniform locations. Only askable once it has
  // linked — asking earlier is itself a wait for the link.
  const locate = () => ({
    aUv: gl.getAttribLocation(prog, "aUv"),
    rect: gl.getUniformLocation(prog, "uRect"),
    res: gl.getUniformLocation(prog, "uRes"),
    centerY: gl.getUniformLocation(prog, "uCenterY"),
    band: gl.getUniformLocation(prog, "uBand"),
    expo: gl.getUniformLocation(prog, "uExpo"),
    stretchY: gl.getUniformLocation(prog, "uStretchY"),
    chroma: gl.getUniformLocation(prog, "uChroma"),
    bleed: gl.getUniformLocation(prog, "uBleed"),
    fade: gl.getUniformLocation(prog, "uFade"),
    halfH: gl.getUniformLocation(prog, "uHalfH"),
    uvScale: gl.getUniformLocation(prog, "uUvScale"),
    uvOffset: gl.getUniformLocation(prog, "uUvOffset"),
    leftGate: gl.getUniformLocation(prog, "uLeftGate"),
    rightGate: gl.getUniformLocation(prog, "uRightGate"),
    arcBow: gl.getUniformLocation(prog, "uArcBow"),
    skewX: gl.getUniformLocation(prog, "uSkewX"),
    scaleY: gl.getUniformLocation(prog, "uScaleY"),
    tex: gl.getUniformLocation(prog, "uTex"),
    glass: gl.getUniformLocation(prog, "uGlass"),
    radius: gl.getUniformLocation(prog, "uRadius"),
    bevel: gl.getUniformLocation(prog, "uBevel"),
    slope: gl.getUniformLocation(prog, "uSlope"),
    thick: gl.getUniformLocation(prog, "uThick"),
    curve: gl.getUniformLocation(prog, "uCurve"),
    eta: gl.getUniformLocation(prog, "uEta"),
    cap: gl.getUniformLocation(prog, "uCap"),
    hasCap: gl.getUniformLocation(prog, "uHasCap"),
    capY0: gl.getUniformLocation(prog, "uCapY0"),
    capCut: gl.getUniformLocation(prog, "uCapCut"),
    vignette: gl.getUniformLocation(prog, "uVignette"),
  });
  let u: ReturnType<typeof locate> | null = null;
  let state: "pending" | "ready" | "failed" = "pending";

  /**
   * Finish the program: link status, locations, the uniforms that never
   * change. `block` false returns early (no wait) while the compile is still
   * running, where the browser can say so; true waits if it must.
   */
  const finish = (block: boolean): boolean => {
    if (state !== "pending") return state === "ready";
    if (
      !block &&
      parallel &&
      !gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)
    ) {
      return false;
    }
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      state = "failed";
      return false;
    }
    gl.useProgram(prog);
    const l = locate();
    u = l;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.enableVertexAttribArray(l.aUv);
    gl.vertexAttribPointer(l.aUv, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(l.tex, 0);
    gl.uniform1i(l.cap, 1);
    gl.uniform1f(l.band, BAND);
    gl.uniform1f(l.expo, EXPO);
    gl.uniform1f(l.stretchY, STRETCH_Y);
    gl.uniform1f(l.chroma, CHROMA);
    gl.uniform1f(l.bleed, BLEED);
    // The slab's shape, the parts that do not scale with the bar.
    gl.uniform1f(l.slope, GLASS.SLOPE);
    gl.uniform1f(l.curve, GLASS.CURVE);
    gl.uniform3f(l.eta, 1 / GLASS.IOR[0], 1 / GLASS.IOR[1], 1 / GLASS.IOR[2]);

    gl.enable(gl.BLEND);
    // Premultiplied blending, to match the shader's premultiplied output.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    state = "ready";
    return true;
  };

  // Where the compile can be polled, finish the program in the background
  // as soon as it is done, so the first drawn frame has nothing left to do.
  let pollTimer = 0;
  if (parallel) {
    const poll = () => {
      pollTimer = 0;
      if (!finish(false) && state === "pending") {
        pollTimer = window.setTimeout(poll, 50);
      }
    };
    pollTimer = window.setTimeout(poll, 50);
  }

  // One texture per source, uploaded the first time it is needed and kept —
  // the rail cycles the same handful of pictures forever. A caller that
  // REDRAWS a composed canvas must hand over a fresh canvas element, not
  // repaint the old one: the upload is keyed on the element and never re-read.
  const texes = new WeakMap<TunnelSource, WebGLTexture>();
  // Every texture ever uploaded, so dispose() can free them all.
  const live = new Set<WebGLTexture>();
  const textureFor = (img: TunnelSource) => {
    const cached = texes.get(img);
    if (cached) return cached;
    if (!sourceReady(img)) return null;
    const t = gl.createTexture();
    if (!t) return null;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Mipmaps for PHOTOGRAPHS only. A baked canvas is built at the size it
    // is shown at (the works strip's bakes, at the canvas's own dpr), so it
    // is never minified — and trilinear on it was blending in the half-
    // resolution level wherever the projection put the texel:pixel ratio
    // a hair past 1, which softened every slab face. A photograph is many
    // times larger than its slat and still needs the chain.
    const mip = canMipmap && img instanceof HTMLImageElement;
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Anisotropic filtering if the driver offers it. The plate is stretched
    // hard along Y while staying put along X, so the sampling footprint is very
    // elongated — exactly the case trilinear alone blurs and shimmers on. The
    // limit was read once, at creation (see `anisoMax`).
    if (aniso && anisoMax > 0) {
      gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, anisoMax);
    }
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    } catch {
      // A cross-origin image without CORS taints the upload; skip it rather
      // than throwing every frame. The rail's own pictures are same-origin.
      gl.deleteTexture(t);
      return null;
    }
    texes.set(img, t);
    live.add(t);
    return t;
  };

  return {
    failed() {
      return state === "failed";
    },
    release(src) {
      const t = texes.get(src);
      if (!t) return;
      texes.delete(src);
      live.delete(t);
      gl.deleteTexture(t);
    },
    render(
      slats,
      vw,
      vh,
      centerY,
      halfH,
      dpr,
      leftGate = 1,
      rightGate = 1,
      arcBow = 0,
      band = BAND,
    ) {
      const bw = Math.max(1, Math.round(vw * dpr));
      const bh = Math.max(1, Math.round(vh * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl.viewport(0, 0, bw, bh);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!slats.length) return;
      // The section is on screen now: finish the program, waiting if it has
      // to. On the usual approach the compile finished long ago and this is
      // a no-op; only a jump straight to the section can still meet it busy.
      if (!finish(true) || !u) return;

      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.vertexAttribPointer(u.aUv, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.uniform2f(u.res, vw, vh);
      gl.uniform1f(u.centerY, centerY);
      gl.uniform1f(u.halfH, halfH);
      gl.uniform1f(u.leftGate, leftGate);
      gl.uniform1f(u.rightGate, rightGate);
      gl.uniform1f(u.arcBow, arcBow);
      // Per frame, not once at setup: the lens is sized from the bar, and the
      // bar's width changes with the viewport (see flareBand).
      gl.uniform1f(u.band, band);

      // No scissor. It was here to stop a warped copy riding over its
      // neighbours, but that was only possible while X was being compressed
      // sideways. With X passing through untouched a tile cannot move into its
      // neighbour's column at all, and the scissor's only remaining effect was
      // to slice the sheet off at the band's inner lip.

      for (const s of slats) {
        const t = textureFor(s.img);
        if (!t) continue;
        // Seam: ramp in over the outer half of the band, so the handoff from
        // the DOM copy is a crossfade rather than a swap.
        // 1, always. The tail's visibility is the `seam` mask in the
        // fragment shader — it is 0 across the part of the tile the DOM still
        // owns and 1 across the tail, which is precisely complementary to the
        // DOM's clip. A per-tile fade on top of that would dim the join.
        gl.uniform1f(u.fade, 1);
        // object-fit: cover, computed the way the DOM does it — crop the
        // long axis, centre what is left. The GL copy has to frame the photo
        // identically to its DOM twin or the picture jumps at the handoff.
        // (A composed canvas is built at the plate's own aspect, so for it
        // this works out to no crop at all.)
        // The box the picture is fitted to: the slat itself, or — for a
        // picture that slides inside a wider box (TunnelSlat.pic) — that box,
        // with the slat's window onto it folded into the same two uniforms:
        //     tex = cover + sx * box,  box = (u + u0) * su
        //         = (cover + sx * su * u0) + (sx * su) * u
        const size = sourceSize(s.img);
        const ia = size.w / Math.max(1, size.h);
        const su = s.pic?.su ?? 1;
        const u0 = s.pic?.u0 ?? 0;
        const ba = s.w / su / Math.max(1, s.h);
        let sx = 1;
        let sy = 1;
        if (ia > ba) sx = ba / ia;
        else sy = ia / ba;
        gl.uniform2f(u.uvScale, sx * su, sy);
        gl.uniform2f(u.uvOffset, (1 - sx) / 2 + sx * su * u0, (1 - sy) / 2);
        gl.uniform1f(u.skewX, s.skew ?? 0);
        gl.uniform1f(u.scaleY, s.scaleY ?? 1);
        gl.uniform4f(u.rect, s.x, s.y, s.w, s.h);
        gl.uniform1f(u.glass, s.glass ? 1 : 0);
        if (s.glass) {
          // The slab's shape, in px of THIS bar. The radius cannot exceed
          // half the shorter side or the rounded box folds over itself.
          const half = Math.min(s.w, s.h) / 2;
          gl.uniform1f(u.radius, Math.min(GLASS.RADIUS_PX, half));
          gl.uniform1f(u.bevel, Math.min(s.w * GLASS.BEVEL, half));
          gl.uniform1f(u.thick, s.w * GLASS.THICK);
          // Uploading binds on the active unit, so the caption is resolved
          // BEFORE the picture is bound on unit 0.
          const c = s.cap ? textureFor(s.cap) : null;
          gl.uniform1f(u.hasCap, c ? 1 : 0);
          gl.uniform1f(u.capY0, s.capY0 ?? 0);
          if (s.capClip === undefined) gl.uniform3f(u.capCut, 0, 0, 0);
          else if (s.capClip === null) gl.uniform3f(u.capCut, -1e4, -1e4, 1);
          else gl.uniform3f(u.capCut, s.capClip.l, s.capClip.r, 1);
          gl.uniform1f(u.vignette, s.vignette ?? 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, c ?? t);
        }
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
      }
    },
    dispose() {
      if (pollTimer) window.clearTimeout(pollTimer);
      for (const t of live) gl.deleteTexture(t);
      live.clear();
      gl.deleteBuffer(vbo);
      gl.deleteBuffer(ibo);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}
