"use client";

import { forwardRef, useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRevealGate } from "@/app/lib/revealGates";

/**
 * The model: the fourth hero variant (lib/heroVariant.ts, /?hero=model —
 * draft). ONE picture of her, fixed to the screen from the top of the page to
 * the end of the services section; the page scrolls past her rather than her
 * scrolling with it:
 *
 *   hero      once the loader's curtain is off, she lifts her head from
 *             looking down to looking into the lens by herself (a 3 s clip,
 *             played, not scrubbed) and holds on its last frame. Framed on her
 *             face and neck from the start; the scroll only pushes in, never
 *             out. The screen keeps breaking: tears, moved blocks, dithered
 *             pixel blocks and a dither sweep, full on while she looks down,
 *             then a hum, a burst every second or so and a surge whenever the
 *             page scrolls; all of it fades out as services arrives. Mist
 *             drifts behind her and a light wanders throughout. The
 *             lift keeps playing if the reader scrolls before it ends.
 *             Reduced motion (or no WebGL): the last frame, still.
 *   →services she and her backdrop (mist, glitch and all) carry on behind
 *             the services' names, closest in (ServicesSectionV3); the glitch
 *             eases a little there so the names read.
 *   after     she fades as the section after services comes up.
 *
 * The clip on a canvas with its own backdrop, and a still of its first frame
 * until the clip has one, laid out identically (the frame's WIDTH is the
 * screen's, never cropped at the sides; zoomed about her face). It lives in a
 * portal on <body>, behind every section's content (z-index -1) and in front
 * of the page background (-10).
 *
 * It draws when something changed (the scroll, a newly decoded frame, the
 * glitch's next step) and otherwise at most 60 times a second for the mist.
 */

const SRC = "/hero/model/lift.mp4";
const START = "/hero/model/lift-start.jpg";
const END = "/hero/model/lift-end.jpg";
/** The approved still itself, full size: once she has looked up, the clip
 * hands over to it (the clip is softer and a touch different in colour). */
const REST = "/hero/model/her-rest.jpg";
/** One natural blink (a Kling clip from her-rest, 21 Oct), cropped to her
 * eyes. Only this rectangle of the picture (fractions of the frame, from the
 * top left) is taken from it, through a soft oval, so the rest of her stays
 * the full-size still and nothing pops when a blink starts or ends. */
const BLINK = "/hero/model/blink.mp4";
const BLINK_RECT: [number, number, number, number] = [0.38993, 0.22491, 0.23364, 0.16729];
/** Her silhouette (softened, from the clip's last frame), so the mist passes behind her. */
const MATTE = "/hero/model/her-matte.png";

/** Hero scroll (0..1) over which the frame pushes in, from CLOSE to IN. */
const PAN = [0, 0.95] as const;
/** The lift's own time (0..1) over which the glitch settles to its hum. */
const SETTLE = [0.05, 0.95] as const;
/** The glitch never stops: a hum (the screen always breaking somewhere), a
 * burst somewhere in every BURST seconds, and a surge while the page scrolls. */
const HUM = 0.32;
const BURST = 0.9;
/** The framing, as zoom: 1 is the whole frame (to mid-chest). 1.32 is the
 * original framing, from before it was zoomed in (21 Oct): face, neck and
 * shoulders. The scroll pushes in a little from there (IN), never out. */
const CLOSE = 1.32;
const IN = 1.55;
/** Where on the frame the zoom centres, from the BOTTOM: her face. (The
 * stills' CSS transform-origin is the same point counted from the top.) */
const FOCUS_Y = 0.62;
/** The backdrop's tone, above and below the frame. */
const FILL: [number, number, number] = [26 / 255, 4 / 255, 13 / 255];

const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `
precision highp float;
varying vec2 v;
uniform sampler2D tex, matte, sharp, blink;
uniform vec2 res;
uniform float aspect, step, amt, zoom, time, haze, alt, rest, blinkOn;
uniform vec4 blinkRect;
uniform vec3 fill;
float h1(vec2 q){ q = fract(q * vec2(.1031, .1030)); q += dot(q, q.yx + 33.33); return fract((q.x + q.y) * q.x); }
float n2(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h1(i), h1(i + vec2(1., 0.)), f.x), mix(h1(i + vec2(0., 1.)), h1(i + vec2(1., 1.)), f.x), f.y);
}
float fbm(vec2 p){
  float r = 0., a = .5;
  for (int i = 0; i < 4; i++) { r += a * n2(p); p = p * 2.03 + vec2(17.1, 9.2); a *= .5; }
  return r;
}
// Ordered (Bayer 4x4) dither threshold, 0..1.
float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
float bayer4(vec2 a){ return bayer2(.5 * a) * .25 + bayer2(a); }
vec2 frameUV(vec2 s){
  float ca = res.x / res.y; vec2 uv = s; uv.y = (uv.y - .5) * aspect / ca + .5;
  return (uv - vec2(.5, ${FOCUS_Y.toFixed(2)})) / zoom + vec2(.5, ${FOCUS_Y.toFixed(2)});
}
vec3 frame(vec2 uv){
  if (uv.y < 0. || uv.y > 1. || uv.x < 0. || uv.x > 1.) return fill;
  // One source at a time: the clip, the full-size still, or (only during the
  // half-second hand-over) both.
  vec2 t = vec2(uv.x, 1. - uv.y);
  vec3 c = rest >= 1. ? texture2D(sharp, t).rgb : texture2D(tex, t).rgb;
  if (rest > 0. && rest < 1.) c = mix(c, texture2D(sharp, t).rgb, rest);
  // A blink: her eyes from the blink clip, through a soft oval.
  if (blinkOn > 0.) {
    vec2 b = (t - blinkRect.xy) / blinkRect.zw;
    vec2 e = (b - .5) / vec2(.5, .5);
    float m = 1. - smoothstep(.55, 1., length(e));
    if (m > 0.) c = mix(c, texture2D(blink, clamp(b, 0., 1.)).rgb, m * blinkOn);
  }
  return mix(fill, c, smoothstep(0., .05, uv.y) * smoothstep(1., .95, uv.y));
}
// Four tones of the site's crimson, picked by an ordered dither.
vec3 dither(vec3 c, vec2 cell){
  float l = dot(c, vec3(.3, .59, .11));
  float q = clamp(floor(l * 3.4 + bayer4(cell)) / 3., 0., 1.);
  vec3 r = mix(vec3(.07, .01, .04), vec3(.68, .07, .2), clamp(q * 1.6, 0., 1.));
  return mix(r, vec3(.98, .76, .82), clamp(q * 1.6 - .6, 0., 1.));
}
void main(){
  vec2 px = v * res; float T = max(28., res.x * .04);
  vec2 s = v;
  float st = step;

  // Screen breaks. Whole-width slices thrown sideways…
  float cb = floor(px.y / (res.y / 14.));
  bool tear = h1(vec2(cb, st * 1.7)) < amt * .2;
  if (tear) s.x += (h1(vec2(cb, st)) - .5) * .26 * amt;
  // …blocks at three sizes, each moved by whole blocks…
  vec2 tb = floor(px / (T * 2.)), tm = floor(px / T), ts = floor(px / (T * .5));
  bool big = h1(tb + st * vec2(3., 11.)) < amt * .06;
  bool med = h1(tm + st * vec2(13., 7.)) < amt * .07;
  bool sml = h1(ts + st * vec2(5., 17.)) < amt * .03;
  if (big) s += floor((vec2(h1(tb + st), h1(tb - st)) - .5) * vec2(7., 3.)) * T * 2. / res;
  else if (med) s += floor((vec2(h1(tm + st), h1(tm - st)) - .5) * vec2(5., 2.)) * T / res;
  else if (sml) s += floor((vec2(h1(ts + st), h1(ts - st)) - .5) * vec2(9., 3.)) * T * .5 / res;
  bool moved = big || med || sml;
  // …and thin scanline smears.
  float band = floor(px.y / (T * .25));
  bool streak = h1(vec2(band, st * 1.3)) < amt * .05;
  if (streak) { float anchor = floor(s.x * 5. + h1(vec2(band, st))) / 5.; s.x = mix(s.x, anchor, .85); }

  // Dither: large regions crushed to pixels in four dithered tones, and a
  // dithered band sweeping down the screen.
  vec2 tp = floor(px / (T * 3.));
  bool pix = h1(tp + st * vec2(7., 5.) + .37) < amt * .1;
  float sweep = fract(-time * .23);
  bool swept = amt > .04 && abs(v.y - sweep) < .01 + .03 * amt;
  float cell = pix ? T * .2 : T * .12;
  if (pix || swept) s = (floor(s * res / cell) + .5) * cell / res;

  vec2 uv = frameUV(s);
  if (moved || tear) uv = clamp(uv, vec2(.002), vec2(.998));
  // The colour split only where the picture is broken: everywhere else one
  // read of the picture per pixel, not three.
  vec3 col;
  if (moved || streak || tear) {
    float split = amt * .011;
    col = vec3(frame(uv + vec2(split, 0.)).r, frame(uv).g, frame(uv - vec2(split, 0.)).b);
  } else {
    col = frame(uv);
  }

  // The backdrop is never still: mist drifting across, slowly turning over,
  // and a light wandering behind her head. Both pass BEHIND her (a soft,
  // spread silhouette, so no hard edge shows), plus a haze in front, low down.
  vec2 m = vec2(s.x * res.x / res.y, s.y);
  float t = time;
  float w = n2(m * 1.6 + vec2(-t * .08, t * .02));
  float f = fbm(m * 2.4 + vec2(-t * .15, -t * .03) + w * 1.4);
  vec2 gc = vec2(.5 + .2 * sin(t * .19), .7 + .07 * sin(t * .13 + 1.3));
  vec2 gd = (s - gc) * vec2(res.x / res.y, 1.);
  float glow = exp(-dot(gd, gd) * 2.4) * (.75 + .25 * sin(t * .6));
  vec2 mu = clamp(uv, 0., 1.);
  float her = (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) ? 0. : texture2D(matte, vec2(mu.x, 1. - mu.y)).r;
  float behind = (1. - her) * haze;
  if (alt > .5) {
    // ?mist=prev (draft): the saved 21 Oct look, pink light added on top.
    float mist = smoothstep(.34, .78, f);
    col *= 1. - behind * .25 * (1. - mist);
    col += behind * (mist * vec3(.48, .19, .25) * .6 + glow * vec3(.4, .1, .18) * .65);
    col += haze * mist * vec3(.46, .18, .24) * .18 * smoothstep(.5, 0., s.y);
  } else {
    // The backdrop in the site's own reds, never pink: its brightness picked
    // out on the brand ramp, near-black maroon -> maroon-deep #38000e ->
    // maroon-dark #470015 -> burgundy #800020 -> (rarely) title red #dc143c.
    // The smoke keeps its texture; only its colour is the palette's. Wisps
    // are rare and red; the gaps between them and a broad, slow shadow
    // drifting the other way darken it. Nothing is laid over her.
    float l = dot(col, vec3(.3, .59, .11));
    vec3 ramp = mix(vec3(.05, 0., .012), vec3(.22, 0., .055), smoothstep(.0, .09, l));
    ramp = mix(ramp, vec3(.28, 0., .082), smoothstep(.07, .16, l));
    ramp = mix(ramp, vec3(.5, 0., .125), smoothstep(.14, .3, l));
    ramp = mix(ramp, vec3(.86, .08, .235) * .8, smoothstep(.32, .6, l));
    float wisp = smoothstep(.52, .9, f);
    float shade = smoothstep(.5, .2, f) * .7 + smoothstep(.5, .85, n2(m * .9 + vec2(t * .06, -t * .02) + 3.1)) * .55;
    vec3 back = ramp * clamp(1. + wisp * .35 + glow * .2 - shade * .75, .2, 1.5);
    col = mix(col, back, behind);
  }

  if (pix || swept) col = dither(col, floor(px / max(2., cell * .25)));
  // A few blocks flare crimson.
  if (h1(tm + st * vec2(9., 5.) + .71) < amt * .012) col = mix(col, vec3(.95, .1, .3) * (.45 + dot(col, vec3(.5))), .75);
  // Scanlines, as strong as the glitch.
  col *= 1. - amt * .12 * mod(floor(px.y * .5), 2.);
  gl_FragColor = vec4(col, 1.);
}`;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (x: number, [a, b]: readonly [number, number]) => clamp01((x - a) / (b - a));
const ease = (x: number) => x * x * (3 - 2 * x);
/** A repeatable 0..1 from an integer. */
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const subscribeToNothing = () => () => {};
const clientBody = () => document.body;
const serverBody = () => null;

/**
 * The Brand Design beat's construction, drawn on her (draft): the geometry a
 * mark would be built from (her face's axis, eye line, eyes, the oval of her
 * face, the triangle from eyes to chin) and the colours of the palette,
 * sampled from her at the points shown (her-rest.jpg, 21 Oct). The drawing
 * is laid out 1000 units across, 558 down, and the svg is in the picture's
 * pixels (5504 x 3072): text has to be set at a real size there, because
 * Chrome misplaces text set tiny and scaled up.
 *
 * Each line draws itself as --p (the beat, 0..1) passes its --s, the dots
 * and labels follow, and the whole of it dims once the board has formed.
 */
const SAMPLES: { name: string; hex: string; x: number; y: number; at: string }[] = [
  { name: "Oxblood", hex: "#2D0117", x: 400, y: 329, at: "jacket" },
  { name: "Bordeaux", hex: "#530B26", x: 505, y: 267, at: "lips" },
  { name: "Mulberry", hex: "#430323", x: 402, y: 143, at: "hair" },
  { name: "Lacquer", hex: "#611133", x: 582, y: 241, at: "leather" },
  { name: "Rose", hex: "#AC5565", x: 465, y: 218, at: "skin" },
];

const K = 5.504; // drawing units to picture pixels


const BrandConstruction = forwardRef<HTMLDivElement>(function BrandConstruction(_, ref) {
  const line = (s: number) => ({ "--s": s }) as React.CSSProperties;
  return (
    <div ref={ref} className="model-marks" style={{ opacity: 0 }}>
      <svg viewBox="0 0 5504 3072" preserveAspectRatio="none" aria-hidden>
        <g className="model-marks__lines" transform={`scale(${K})`}>
          <line x1="506.6" y1="40" x2="506.6" y2="330" pathLength={1} style={line(0.04)} />
          <line x1="372" y1="171.4" x2="640" y2="171.4" pathLength={1} style={line(0.08)} />
          <line x1="452" y1="233.9" x2="561" y2="233.9" pathLength={1} style={line(0.14)} />
          <line x1="447" y1="269" x2="566" y2="269" pathLength={1} style={line(0.16)} />
          <ellipse cx="507" cy="195" rx="76" ry="95" pathLength={1} style={line(0.1)} />
          <circle cx="507" cy="195" r="122" pathLength={1} style={line(0.2)} />
          <circle cx="465.7" cy="171.9" r="21" pathLength={1} style={line(0.12)} />
          <circle cx="547.6" cy="170.9" r="21" pathLength={1} style={line(0.12)} />
          <circle cx="465.7" cy="171.9" r="8" pathLength={1} style={line(0.18)} />
          <circle cx="547.6" cy="170.9" r="8" pathLength={1} style={line(0.18)} />
          <polyline points="465.7,171.9 507,289 547.6,170.9" pathLength={1} style={line(0.22)} />
        </g>
        <g className="model-marks__labels">
          <text x={512 * K} y={318 * K}>AXIS · 0.507</text>
          <text x={590 * K} y={167 * K}>EYE LINE</text>
          <text x={598 * K} y={302 * K}>Ø 1 : 1.618</text>
          <text x={414 * K} y={245 * K}>NOSE</text>
          <text x={412 * K} y={281 * K}>MOUTH</text>
        </g>
        <g className="model-marks__samples">
          {SAMPLES.map((p, i) => (
            <g key={p.name} style={{ "--i": i } as React.CSSProperties}>
              <circle cx={p.x * K} cy={p.y * K} r={5.5 * K} fill={p.hex} />
              <circle cx={p.x * K} cy={p.y * K} r={8 * K} className="model-marks__ring" />
              <text x={(p.x + 12) * K} y={(p.y - 2) * K}>{p.name.toUpperCase()}</text>
              <text x={(p.x + 12) * K} y={(p.y + 7) * K} className="model-marks__hex">{p.hex} · {p.at}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
});

export default function HeroModelDesktop() {
  // The stage is a portal on <body>, so it renders on the client only (the
  // server has no body to put it in): the same pattern as useHeroVariant.
  const host = useSyncExternalStore(subscribeToNothing, clientBody, serverBody);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stillRef = useRef<HTMLImageElement>(null);
  const marksRef = useRef<HTMLDivElement>(null);

  // The curtain waits for the first still (or for it to fail).
  const settleGate = useRevealGate("hero-model");
  useEffect(() => {
    if (!host) return;
    const still = stillRef.current;
    if (!still) return settleGate();
    still.decode().then(settleGate, settleGate);
  }, [host, settleGate]);

  // The hero is taller under this variant, after the page was laid out as the
  // default one: anything that measured the sections measures again.
  useEffect(() => {
    const raf = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!host) return;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const still = stillRef.current;
    const marks = marksRef.current;
    if (!stage || !canvas || !still || !marks) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Draft-only switches, for comparing looks side by side: ?mist=0 leaves
    // the backdrop as filmed, ?mist=prev is the saved 21 Oct mist, ?glitch=0
    // holds the picture clean.
    const query = new URLSearchParams(window.location.search);
    const noMist = query.get("mist") === "0";
    const altMist = query.get("mist") === "prev"; // the saved 21 Oct mist, to compare
    const noGlitch = query.get("glitch") === "0";
    const zoomParam = query.get("zoom") ? parseFloat(query.get("zoom") as string) || null : null;

    // The still (the first frame, shown until the clip has one) follows the
    // same layout as the canvas: the frame's width is the screen's, zoomed
    // about her face.
    // Styles are written only when they change: an unchanged frame then
    // leaves nothing for the browser to recalculate before the next read.
    const written = new Map<HTMLElement, Record<string, string>>();
    const put = (el: HTMLElement, prop: "opacity" | "visibility" | "transform" | "left" | "top" | "width" | "height", value: string) => {
      const was = written.get(el) ?? {};
      if (was[prop] === value) return;
      was[prop] = value;
      written.set(el, was);
      el.style[prop] = value;
    };
    const place = (el: HTMLElement, zoom: number) => {
      put(el, "transform", `translateY(-50%) scale(${zoom.toFixed(4)})`);
    };
    still.style.transformOrigin = `50% ${((1 - FOCUS_Y) * 100).toFixed(1)}%`;
    // The construction is NOT scaled with a transform like the still: it is
    // sized and placed outright, so its svg is drawn at its true size. Chrome
    // kept a scaled layer's text painted where it was at an earlier zoom.
    const placeMarks = (zoom: number) => {
      const vw = window.innerWidth;
      const h0 = vw / (5504 / 3072);
      const w = vw * zoom;
      const h = h0 * zoom;
      const o = 1 - FOCUS_Y; // the zoom's centre on the frame, from the top
      put(marks, "left", `${((vw - w) / 2).toFixed(1)}px`);
      put(marks, "top", `${(window.innerHeight / 2 - h0 / 2 + o * h0 - o * h).toFixed(1)}px`);
      put(marks, "width", `${w.toFixed(1)}px`);
      put(marks, "height", `${h.toFixed(1)}px`);
    };

    let gl: WebGLRenderingContext | null = null;
    let tex: WebGLTexture | null = null;
    let prog: WebGLProgram | null = null;
    let buf: WebGLBuffer | null = null;
    let matteTex: WebGLTexture | null = null;
    let haze = 0; // the mist waits for her silhouette, or it would cross her face
    const restImg = new Image();
    let restDecoded = false;
    let restTex: WebGLTexture | null = null;
    let restAt = 0; // when the hand-over to the still began (0: not yet)
    // Blinking, once she has settled on the still: at random, a few seconds
    // apart, now and then twice; only in the hero.
    const blinkVideo = document.createElement("video");
    let blinkTex: WebGLTexture | null = null;
    let blinkReady = false;
    let blinking = false;
    let doubled = false;
    let nextBlinkAt = 0;
    const U: Record<string, WebGLUniformLocation | null> = {};
    const video = document.createElement("video");
    let aspect = 16 / 9;
    let ready = false;
    let frameWaiting = false;
    let haveFrame = false;
    // The lift: waits for the curtain to be off, then plays once and holds.
    let uncovered = !!(window as Window & { __appUncovered?: boolean }).__appUncovered;
    let started = false;
    let done = false;
    let liftAt = 0; // when the lift started (performance.now)

    if (!reduced) {
      gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, alpha: false });
    }
    if (gl) {
      const g = gl;
      const compile = (type: number, src: string) => {
        const s = g.createShader(type)!;
        g.shaderSource(s, src);
        g.compileShader(s);
        return s;
      };
      prog = g.createProgram()!;
      g.attachShader(prog, compile(g.VERTEX_SHADER, VERT));
      g.attachShader(prog, compile(g.FRAGMENT_SHADER, FRAG));
      g.linkProgram(prog);
      if (g.getProgramParameter(prog, g.LINK_STATUS)) {
        g.useProgram(prog);
        buf = g.createBuffer();
        g.bindBuffer(g.ARRAY_BUFFER, buf);
        g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
        const loc = g.getAttribLocation(prog, "p");
        g.enableVertexAttribArray(loc);
        g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
        for (const n of ["res", "aspect", "step", "amt", "zoom", "fill", "time", "haze", "alt", "rest", "blinkOn", "blinkRect", "tex", "matte", "sharp", "blink"]) U[n] = g.getUniformLocation(prog, n);
        tex = g.createTexture();
        g.bindTexture(g.TEXTURE_2D, tex);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
        g.uniform3f(U.fill, ...FILL);
        g.uniform1f(U.alt, altMist ? 1 : 0);
        g.uniform1i(U.tex, 0);
        g.uniform1i(U.matte, 1);
        g.uniform1i(U.sharp, 2);
        g.uniform1i(U.blink, 3);
        g.uniform4f(U.blinkRect, ...BLINK_RECT);
        blinkVideo.muted = true;
        blinkVideo.playsInline = true;
        blinkVideo.preload = "auto";
        blinkVideo.addEventListener("loadeddata", () => (blinkReady = true));
        blinkVideo.addEventListener("ended", () => {
          blinking = false;
          // Now and then a second blink straight after, as people do.
          if (!doubled && Math.random() < 0.2) {
            doubled = true;
            nextBlinkAt = performance.now() + 160;
          } else {
            doubled = false;
            nextBlinkAt = performance.now() + 3500 + Math.random() * 5500;
          }
        });
        blinkVideo.src = BLINK;
        // Decoded ahead, uploaded at the hand-over (under a glitch burst).
        restImg.src = REST;
        restImg.decode().then(() => (restDecoded = true), () => {});
        const matteImg = new Image();
        matteImg.onload = () => {
          matteTex = g.createTexture();
          g.activeTexture(g.TEXTURE1);
          g.bindTexture(g.TEXTURE_2D, matteTex);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
          g.texImage2D(g.TEXTURE_2D, 0, g.LUMINANCE, g.LUMINANCE, g.UNSIGNED_BYTE, matteImg);
          g.activeTexture(g.TEXTURE0);
          g.bindTexture(g.TEXTURE_2D, tex);
          haze = noMist ? 0 : 1;
        };
        matteImg.src = MATTE;

        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";
        // 1.5x the clip's own pace (agreed 23 Oct: about 2 s, as on phones).
        video.defaultPlaybackRate = 1.5;
        video.playbackRate = 1.5;
        // A paused video only hands WebGL a decoded frame after a seek: nudge it once.
        video.addEventListener("loadeddata", () => {
          aspect = video.videoWidth / video.videoHeight;
          ready = true;
          video.currentTime = 0.001;
          startLift();
        });
        video.addEventListener("seeked", () => {
          frameWaiting = true;
        });
        // She holds on the last frame (an ended video keeps showing it).
        video.addEventListener("ended", () => {
          done = true;
          frameWaiting = true;
        });
        video.src = SRC;
      } else {
        gl = null;
      }
    }
    // Without the clip she simply looks at the reader.
    if (!gl) still.src = END;

    // Upload only the frames the video actually presents, where the browser
    // says which those are; elsewhere, every tick while it plays.
    const frameCallbacks = typeof video.requestVideoFrameCallback === "function";
    let vfc = 0;
    const onVideoFrame = () => {
      frameWaiting = true;
      if (!done) vfc = video.requestVideoFrameCallback(onVideoFrame);
    };

    function startLift() {
      if (started || !uncovered || !ready) return;
      started = true;
      liftAt = performance.now();
      if (frameCallbacks) vfc = video.requestVideoFrameCallback(onVideoFrame);
      // Muted, inline: allowed to play by itself. If it is refused anyway,
      // skip to where it would have ended rather than leave her looking down.
      video.play().catch(() => {
        done = true;
        liftAt = -Infinity;
        video.currentTime = Math.max(0, video.duration - 0.05);
      });
    }
    const onUncovered = () => {
      uncovered = true;
      startLift();
    };
    if (!uncovered) window.addEventListener("app:uncovered", onUncovered, { once: true });

    let raf = 0;
    let last = { zoom: -1, amt: -1, step: -1, w: 0, h: 0, at: 0, rest: -1 };
    let then = performance.now();
    let coveringNow = false;
    let lastBrand = -1;
    let lastY = window.scrollY;
    let surge = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const vh = window.innerHeight;

      // Where the reader is: through the hero, into services, past them. Both
      // are looked up every frame: the services section is hydrated on
      // approach (LazyHydrate), which can replace its element.
      const hero = document.getElementById("hero-banner");
      const services = document.getElementById("services");
      if (!hero) return;
      const hr = hero.getBoundingClientRect();
      const heroP = clamp01(-hr.top / Math.max(1, hr.height - vh));
      const sr = services?.isConnected ? services.getBoundingClientRect() : null;
      const into = sr ? clamp01(1 - sr.top / vh) : 0; // services coming up over the hero's last screen
      const past = sr ? clamp01(1 - sr.bottom / vh) : 0; // the section after services coming up
      const pan = ease(span(heroP, PAN));
      const hand = ease(into);
      // Her face and neck from the start; the scroll only pushes in, and
      // services keeps the closest framing.
      const since = started ? (now - liftAt) / 1000 : 0;
      // ?zoom=N (draft, to compare framings side by side): opens at N instead.
      const close = zoomParam ?? CLOSE;
      const zoom = close + (IN - CLOSE) * Math.max(pan, hand);
      put(stage, "opacity", (1 - ease(past)).toFixed(3));
      // Not drawn while an opaque services scene or the atelier covers her.
      const covered = services?.querySelector<HTMLElement>(".svv3__pin")?.dataset.cover === "1" || document.body.classList.contains("atelier-open");
      put(stage, "visibility", past >= 1 || covered ? "hidden" : "visible");

      // Her backdrop carries on behind the services: the same picture, no
      // cut-out (its rough edges showed against the page's background).
      place(still, zoom);
      // The Brand Design beat draws its construction on her, in the picture's
      // own coordinates, so it stays on her eyes and jaw at any zoom
      // (ServicesSectionV3 sets --brand-open, 0..1, on its pin).
      const pin = services?.querySelector<HTMLElement>(".svv3__pin");
      const brand = pin ? parseFloat(pin.style.getPropertyValue("--brand-open")) || 0 : 0;
      placeMarks(zoom);
      put(marks, "opacity", brand > 0 ? "1" : "0");
      if (brand !== lastBrand) {
        lastBrand = brand;
        marks.style.setProperty("--p", brand.toFixed(3));
      }
      if (!gl || !ready) return;
      put(canvas, "opacity", haveFrame ? "1" : "0");
      put(still, "opacity", haveFrame ? "0" : "1");
      // While the canvas fills the screen, opaque, the page background behind
      // it cannot be seen: say so, and it pauses (backgroundCover.ts). Dropped
      // the moment the stage starts to fade, so it is running again first.
      const covering = haveFrame && past <= 0;
      if (covering !== coveringNow) {
        coveringNow = covering;
        if (covering) stage.dataset.bgCover = "";
        else delete stage.dataset.bgCover;
        window.dispatchEvent(new Event("scroll")); // it re-checks on scroll
      }
      if (past >= 1 || covered) return; // gone, or covered

      if (started && !done && !frameCallbacks && !video.paused) frameWaiting = true;
      let changed = false;
      if (frameWaiting && !video.seeking && video.readyState >= 2) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
        frameWaiting = false;
        haveFrame = true;
        changed = true;
      }

      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      // The glitch: full on while she looks down, settling to its hum as she
      // looks up (the lift's own time, not the scroll). Then a burst in every
      // BURST seconds at a random moment, length and strength, and a surge
      // whenever the page moves, fading fast once it stops.
      const liftT = done ? 1 : started && video.duration ? video.currentTime / video.duration : 0;
      let amt = HUM + (1 - HUM) * (1 - ease(span(liftT, SETTLE)));
      const after = done ? since - 3.2 : -1;
      if (after > 0) {
        const k = Math.floor(after / BURST);
        for (const j of [k - 1, k]) {
          const at = j * BURST + hash(j) * BURST * 0.6;
          const len = 0.22 + 0.3 * hash(j + 0.5);
          const x = (after - at) / len;
          if (j >= 0 && x > 0 && x < 1) amt = Math.max(amt, (0.6 + 0.4 * hash(j + 0.25)) * Math.sin(Math.PI * x));
        }
      }
      const dt = Math.min(0.1, (now - then) / 1000);
      then = now;
      const speed = dt > 0 ? Math.abs(window.scrollY - lastY) / dt / vh : 0; // screens a second
      lastY = window.scrollY;
      surge = Math.max(Math.min(0.7, speed * 0.5), surge * Math.pow(0.03, dt));
      if (surge < 0.01) surge = 0; // at rest, nothing left to redraw for
      // The effects belong to the hero: they fade out as services arrives and
      // stay off there, so its titles and copy read clean (the mist goes on).
      amt = Math.round(Math.min(1, amt + surge) * (1 - hand) * 100) / 100;
      // Once she has looked up, hand over from the clip to the approved still,
      // full size: half a second, under a burst so the switch never reads.
      let rest = 0;
      if (done && restDecoded) {
        if (!restAt) {
          restAt = now;
          restTex = gl.createTexture();
          gl.activeTexture(gl.TEXTURE2);
          gl.bindTexture(gl.TEXTURE_2D, restTex);
          for (const [k, val] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, val);
          const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
          if (restImg.naturalWidth <= max) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, restImg);
          } else {
            const small = document.createElement("canvas");
            small.width = max;
            small.height = Math.round((max * restImg.naturalHeight) / restImg.naturalWidth);
            small.getContext("2d")?.drawImage(restImg, 0, 0, small.width, small.height);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, small);
          }
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, tex);
        }
        const x = (now - restAt) / 500;
        rest = ease(clamp01(x));
        if (x < 1.3) amt = Math.max(amt, 0.8 * Math.sin(Math.PI * clamp01(x / 1.3)));
      }
      // Blinks: first one 2.5-4 s after she settles, then at random.
      let blinkOn = 0;
      if (rest >= 1 && blinkReady) {
        if (!nextBlinkAt) nextBlinkAt = now + 2500 + Math.random() * 1500;
        if (!blinking && now >= nextBlinkAt && hand < 0.3) {
          blinking = true;
          blinkVideo.currentTime = 0;
          blinkVideo.play().catch(() => (blinking = false));
        }
        if (blinking && blinkVideo.readyState >= 2) {
          if (!blinkTex) {
            blinkTex = gl.createTexture();
            gl.activeTexture(gl.TEXTURE3);
            gl.bindTexture(gl.TEXTURE_2D, blinkTex);
            for (const [k, val] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, val);
          } else {
            gl.activeTexture(gl.TEXTURE3);
            gl.bindTexture(gl.TEXTURE_2D, blinkTex);
          }
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, blinkVideo);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          blinkOn = 1;
          changed = true;
        }
      }
      if (noGlitch) amt = 0;
      const step = Math.floor((now / 1000) * 12);
      // The mist alone moves slowly: 60 redraws a second are plenty for it.
      // Anything else (scroll, a new frame, the glitch) draws at once.
      const mistDue = haze > 0 && now - last.at >= 16;
      if (!changed && !mistDue && rest === last.rest && zoom === last.zoom && amt === last.amt && step === last.step && w === last.w && h === last.h) return;
      last = { zoom, amt, step, w, h, at: now, rest };
      gl.uniform1f(U.time, now / 1000);
      gl.uniform1f(U.haze, haze);
      gl.uniform1f(U.rest, rest);
      gl.uniform1f(U.blinkOn, blinkOn);
      gl.uniform2f(U.res, w, h);
      gl.uniform1f(U.aspect, aspect);
      gl.uniform1f(U.step, step);
      gl.uniform1f(U.amt, amt);
      gl.uniform1f(U.zoom, zoom);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("app:uncovered", onUncovered);
      if (vfc) video.cancelVideoFrameCallback(vfc);
      video.pause();
      blinkVideo.pause();
      blinkVideo.removeAttribute("src");
      video.removeAttribute("src");
      video.load();
      if (gl) {
        gl.deleteTexture(tex);
        gl.deleteTexture(matteTex);
        gl.deleteTexture(restTex);
        gl.deleteTexture(blinkTex);
        gl.deleteBuffer(buf);
        gl.deleteProgram(prog);
      }
    };
  }, [host]);

  if (!host) return null;
  return createPortal(
    <div ref={stageRef} data-hero-model aria-hidden className="model-stage">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={stillRef} src={START} alt="" draggable={false} decoding="async" className="model-stage__frame" />
      <canvas ref={canvasRef} className="model-stage__canvas" style={{ opacity: 0 }} />
      <BrandConstruction ref={marksRef} />
    </div>,
    host,
  );
}
